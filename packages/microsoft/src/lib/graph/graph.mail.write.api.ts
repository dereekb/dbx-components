import { type EmailAddress, type Maybe, type Milliseconds } from '@dereekb/util';
import { type MicrosoftGraphRequestInput, microsoftGraphPathWithQuery, microsoftGraphRequest } from './graph.api';
import { type MicrosoftGraphBatchRequestItem, isMicrosoftGraphBatchResponseOk, microsoftGraphBatch } from './graph.batch.api';
import { type MicrosoftGraphContext } from './graph.config';
import { MicrosoftGraphError, type MicrosoftGraphErrorData } from './graph.error.api';
import { type MicrosoftGraphMailboxInput, microsoftGraphGetMessageRequest, microsoftGraphMailHeaders, microsoftGraphMailboxPath, microsoftGraphMessagePath, microsoftGraphMessagesPath } from './graph.mail.api';
import { microsoftGraphUploadSessionPut } from './graph.upload.api';
import { type MicrosoftGraphItemBody, type MicrosoftGraphMessage, type MicrosoftGraphRecipient } from './graph.type';

/**
 * Files under this size are attached inline (base64 in the message). Larger ones need an upload session.
 *
 * @see https://learn.microsoft.com/en-us/graph/outlook-large-attachments
 */
export const MICROSOFT_GRAPH_MESSAGE_INLINE_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;

/**
 * The largest file an Outlook attachment upload session takes.
 *
 * @see https://learn.microsoft.com/en-us/graph/outlook-large-attachments
 */
export const MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_MAX_BYTES = 150 * 1024 * 1024;

/**
 * The bytes per chunk PUT of an Outlook attachment upload session; each request must stay under 4 MB.
 */
export const MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_CHUNK_BYTES = 3 * 1024 * 1024;

/**
 * The well-known folder `deleteMessages` moves a message to unless `hard` is set.
 */
export const MICROSOFT_GRAPH_DELETED_ITEMS_FOLDER = 'deleteditems';

/**
 * A file to attach to an outgoing message.
 */
export interface MicrosoftGraphFileAttachmentInput {
  readonly name: string;
  readonly contentType?: Maybe<string>;
  readonly bytes: Uint8Array;
}

/**
 * An outgoing message's fields. Only the fields given are sent, so the same input serves a PATCH.
 */
export interface MicrosoftGraphOutgoingMessageInput {
  readonly subject?: Maybe<string>;
  readonly body?: Maybe<MicrosoftGraphItemBody>;
  readonly to?: Maybe<readonly EmailAddress[]>;
  readonly cc?: Maybe<readonly EmailAddress[]>;
  readonly bcc?: Maybe<readonly EmailAddress[]>;
  /**
   * The address the message is sent as (`from`). Sending as another mailbox needs Exchange Send As or Send
   * on Behalf on it.
   *
   * @see https://learn.microsoft.com/en-us/graph/outlook-send-mail-from-other-user
   */
  readonly from?: Maybe<EmailAddress>;
  /**
   * Files attached inline. Each must be under {@link MICROSOFT_GRAPH_MESSAGE_INLINE_ATTACHMENT_MAX_BYTES};
   * attach larger ones to a draft with {@link uploadMessageAttachment}.
   */
  readonly attachments?: Maybe<readonly MicrosoftGraphFileAttachmentInput[]>;
}

/**
 * Encodes bytes as base64 without Node's `Buffer`.
 *
 * @param bytes - The bytes.
 * @returns The base64 text.
 */
export function microsoftGraphBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;

  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCodePoint(...bytes.subarray(i, i + step));
  }

  return btoa(binary);
}

/**
 * Turns addresses into Graph recipients.
 *
 * @param addresses - The addresses.
 * @returns The recipients.
 */
export function microsoftGraphRecipients(addresses: readonly EmailAddress[]): MicrosoftGraphRecipient[] {
  return addresses.map((address) => ({ emailAddress: { address } }));
}

/**
 * Builds the Graph `message` resource for an outgoing message, with only the fields given.
 *
 * @param input - The message fields.
 * @returns The message resource.
 * @throws {Error} When an attachment is too large to attach inline.
 */
export function microsoftGraphOutgoingMessage(input: MicrosoftGraphOutgoingMessageInput): Record<string, unknown> {
  const message: Record<string, unknown> = {};

  if (input.subject != null) {
    message['subject'] = input.subject;
  }

  if (input.body != null) {
    message['body'] = input.body;
  }

  if (input.to != null) {
    message['toRecipients'] = microsoftGraphRecipients(input.to);
  }

  if (input.cc != null) {
    message['ccRecipients'] = microsoftGraphRecipients(input.cc);
  }

  if (input.bcc != null) {
    message['bccRecipients'] = microsoftGraphRecipients(input.bcc);
  }

  if (input.from != null) {
    message['from'] = { emailAddress: { address: input.from } };
  }

  if (input.attachments?.length) {
    message['attachments'] = input.attachments.map((attachment) => {
      if (attachment.bytes.length >= MICROSOFT_GRAPH_MESSAGE_INLINE_ATTACHMENT_MAX_BYTES) {
        throw new Error(`Attachment "${attachment.name}" is ${attachment.bytes.length} bytes; inline attachments must be under ${MICROSOFT_GRAPH_MESSAGE_INLINE_ATTACHMENT_MAX_BYTES}. Upload it to a draft instead.`);
      }

      return { '@odata.type': '#microsoft.graph.fileAttachment', name: attachment.name, contentType: attachment.contentType ?? 'application/octet-stream', contentBytes: microsoftGraphBase64(attachment.bytes) };
    });
  }

  return message;
}

// MARK: Request builders
export interface MicrosoftGraphCreateDraftInput extends MicrosoftGraphMailboxInput {
  readonly message: MicrosoftGraphOutgoingMessageInput;
}

/**
 * Builds the POST that creates a draft in the mailbox's Drafts folder (Graph answers 201 with the message).
 *
 * @param input - The mailbox and message.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-post-messages
 */
export function microsoftGraphCreateDraftRequest(input: MicrosoftGraphCreateDraftInput): MicrosoftGraphRequestInput {
  return { method: 'POST', path: microsoftGraphMessagesPath({ mailbox: input.mailbox }), headers: microsoftGraphMailHeaders(input), body: microsoftGraphOutgoingMessage(input.message) };
}

export interface MicrosoftGraphUpdateDraftInput extends MicrosoftGraphCreateDraftInput {
  readonly id: string;
}

/**
 * Builds the PATCH that changes a draft. Only the given fields are sent.
 *
 * @param input - The mailbox, draft id and changed fields.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/message-update
 */
export function microsoftGraphUpdateDraftRequest(input: MicrosoftGraphUpdateDraftInput): MicrosoftGraphRequestInput {
  return { method: 'PATCH', path: microsoftGraphMessagePath(input), headers: microsoftGraphMailHeaders(input), body: microsoftGraphOutgoingMessage(input.message) };
}

export interface MicrosoftGraphMessageIdInput extends Pick<MicrosoftGraphMailboxInput, 'mailbox'> {
  readonly id: string;
}

/**
 * Builds the POST that sends an existing draft (Graph answers 202 with no body).
 *
 * @param input - The mailbox and draft id.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/message-send
 */
export function microsoftGraphSendDraftRequest(input: MicrosoftGraphMessageIdInput): MicrosoftGraphRequestInput {
  return { method: 'POST', path: `${microsoftGraphMessagePath(input)}/send` };
}

export interface MicrosoftGraphSendMailInput extends Pick<MicrosoftGraphMailboxInput, 'mailbox'> {
  readonly message: MicrosoftGraphOutgoingMessageInput;
  /**
   * Whether the sent copy is saved to Sent Items. Defaults to true.
   */
  readonly saveToSentItems?: Maybe<boolean>;
}

/**
 * Builds the one-shot `sendMail` POST (Graph answers 202 with no body and returns no id).
 *
 * With `mailbox`, the message is sent from that mailbox (`/users/{upn}/sendMail`), saved to its Sent Items,
 * and needs Full Access plus Send As or Send on Behalf. Without it, a `message.from` sends as another
 * address while the copy lands in the user's own Sent Items.
 *
 * @param input - The mailbox, message and Sent Items flag.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-sendmail
 */
export function microsoftGraphSendMailRequest(input: MicrosoftGraphSendMailInput): MicrosoftGraphRequestInput {
  return { method: 'POST', path: `${microsoftGraphMailboxPath(input.mailbox)}/sendMail`, body: { message: microsoftGraphOutgoingMessage(input.message), saveToSentItems: input.saveToSentItems !== false } };
}

/**
 * How a message is answered: `reply`, `replyAll` or `forward`.
 */
export type MicrosoftGraphMessageResponseKind = 'reply' | 'replyAll' | 'forward';

export interface MicrosoftGraphRespondToMessageInput extends MicrosoftGraphMailboxInput {
  /**
   * The message being answered.
   */
  readonly id: string;
  readonly kind: MicrosoftGraphMessageResponseKind;
  /**
   * Creates a draft (`createReply` / `createReplyAll` / `createForward`, 201 with the draft) instead of
   * sending (202).
   */
  readonly draft?: Maybe<boolean>;
  /**
   * Text placed above the quoted original. Cannot be combined with `message.body`.
   */
  readonly comment?: Maybe<string>;
  /**
   * Message fields to set, e.g. the forward's `to`, or a `body` in place of `comment`.
   */
  readonly message?: Maybe<MicrosoftGraphOutgoingMessageInput>;
}

/**
 * Returns the Graph action a reply, reply-all or forward calls.
 *
 * @param kind - The response kind.
 * @param draft - Whether to create a draft instead of sending.
 * @returns The action, e.g. `replyAll` or `createForward`.
 */
export function microsoftGraphMessageResponseAction(kind: MicrosoftGraphMessageResponseKind, draft: Maybe<boolean>): string {
  return draft ? `create${kind.charAt(0).toUpperCase()}${kind.slice(1)}` : kind;
}

/**
 * Builds the POST that replies to, replies all to, or forwards a message, or creates the draft of one.
 *
 * @param input - The message, response kind, draft flag, comment and message fields.
 * @returns The request.
 * @throws {Error} When both `comment` and `message.body` are given: Graph answers 400 to that.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/message-reply
 * @see https://learn.microsoft.com/en-us/graph/api/message-forward
 */
export function microsoftGraphRespondToMessageRequest(input: MicrosoftGraphRespondToMessageInput): MicrosoftGraphRequestInput {
  if (input.comment != null && input.message?.body != null) {
    throw new Error('A reply or forward takes a comment or a message body, not both (Graph answers 400).');
  }

  const body: Record<string, unknown> = {};

  if (input.comment != null) {
    body['comment'] = input.comment;
  }

  if (input.message != null) {
    const message = microsoftGraphOutgoingMessage(input.message);

    if (Object.keys(message).length > 0) {
      body['message'] = message;
    }
  }

  return { method: 'POST', path: `${microsoftGraphMessagePath(input)}/${microsoftGraphMessageResponseAction(input.kind, input.draft)}`, headers: input.draft ? microsoftGraphMailHeaders(input) : undefined, body };
}

export interface MicrosoftGraphMoveMessageInput extends MicrosoftGraphMailboxInput {
  readonly id: string;
  /**
   * The destination folder id or well-known name (`inbox`, `archive`, `deleteditems`).
   */
  readonly destination: string;
  /**
   * Copies instead of moving.
   */
  readonly copy?: Maybe<boolean>;
}

/**
 * Builds the POST that moves or copies a message to another folder (Graph answers 201 with the message at
 * its new location). Without immutable ids, the moved message gets a new id.
 *
 * @param input - The mailbox, message, destination and copy flag.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/message-move
 */
export function microsoftGraphMoveMessageRequest(input: MicrosoftGraphMoveMessageInput): MicrosoftGraphRequestInput {
  return { method: 'POST', path: `${microsoftGraphMessagePath(input)}/${input.copy ? 'copy' : 'move'}`, headers: microsoftGraphMailHeaders(input), body: { destinationId: input.destination } };
}

/**
 * Builds the POST that permanently deletes a message: it skips Deleted Items and Recoverable Items and cannot
 * be recovered.
 *
 * @param input - The mailbox and message.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/message-permanentdelete
 */
export function microsoftGraphPermanentDeleteMessageRequest(input: MicrosoftGraphMessageIdInput): MicrosoftGraphRequestInput {
  return { method: 'POST', path: `${microsoftGraphMessagePath(input)}/permanentDelete` };
}

// MARK: Executors
/**
 * Thrown by {@link updateDraftMessage} when the message is no longer a draft: Graph only lets a draft's
 * recipients, subject and body change.
 */
export class MicrosoftGraphMessageNotDraftError extends Error {
  readonly messageId: string;

  constructor(messageId: string) {
    super(`Message "${messageId}" is not a draft; only a draft's recipients, subject and body can be changed.`);
    this.name = 'MicrosoftGraphMessageNotDraftError';
    this.messageId = messageId;
  }
}

/**
 * Creates a draft. Requires `Mail.ReadWrite` (`Mail.ReadWrite.Shared` for another mailbox).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that creates the draft and resolves it, with an immutable id unless turned off.
 */
export function createDraftMessage(context: MicrosoftGraphContext): (input: MicrosoftGraphCreateDraftInput) => Promise<MicrosoftGraphMessage> {
  const request = microsoftGraphRequest(context);
  return (input) => request(microsoftGraphCreateDraftRequest(input));
}

/**
 * Builds the GET {@link updateDraftMessage} reads first to check the message is still a draft.
 *
 * @param input - The mailbox and message.
 * @returns The request.
 */
export function microsoftGraphDraftStateRequest(input: MicrosoftGraphMessageIdInput & Pick<MicrosoftGraphMailboxInput, 'immutableIds'>): MicrosoftGraphRequestInput {
  return { method: 'GET', ...microsoftGraphGetMessageRequest({ ...input, select: 'id,isDraft' }) };
}

/**
 * Changes a draft, after checking it is still a draft. Requires `Mail.ReadWrite`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that updates the draft and resolves it.
 * @throws {MicrosoftGraphMessageNotDraftError} When the message has been sent (`isDraft` is false).
 */
export function updateDraftMessage(context: MicrosoftGraphContext): (input: MicrosoftGraphUpdateDraftInput) => Promise<MicrosoftGraphMessage> {
  const request = microsoftGraphRequest(context);

  return async (input) => {
    const current = await request<MicrosoftGraphMessage>(microsoftGraphDraftStateRequest(input));

    if (current.isDraft === false) {
      throw new MicrosoftGraphMessageNotDraftError(input.id);
    }

    return request<MicrosoftGraphMessage>(microsoftGraphUpdateDraftRequest(input));
  };
}

/**
 * Sends an existing draft. Requires `Mail.Send`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that sends the draft.
 */
export function sendDraftMessage(context: MicrosoftGraphContext): (input: MicrosoftGraphMessageIdInput) => Promise<void> {
  const request = microsoftGraphRequest(context);
  return async (input) => {
    await request(microsoftGraphSendDraftRequest(input));
  };
}

/**
 * Sends a new message in one call. Requires `Mail.Send` (`Mail.Send.Shared` from another mailbox).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that sends the message.
 */
export function sendMail(context: MicrosoftGraphContext): (input: MicrosoftGraphSendMailInput) => Promise<void> {
  const request = microsoftGraphRequest(context);
  return async (input) => {
    await request(microsoftGraphSendMailRequest(input));
  };
}

/**
 * Replies, replies all or forwards, or creates the draft of one. Sending requires `Mail.Send`; a draft
 * requires `Mail.ReadWrite`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that resolves the draft with `draft`, else nothing (Graph answers 202).
 */
export function respondToMessage(context: MicrosoftGraphContext): (input: MicrosoftGraphRespondToMessageInput) => Promise<Maybe<MicrosoftGraphMessage>> {
  const request = microsoftGraphRequest(context);
  return async (input) => (await request<Maybe<MicrosoftGraphMessage>>(microsoftGraphRespondToMessageRequest(input))) ?? undefined;
}

export interface MicrosoftGraphUploadMessageAttachmentInput extends Pick<MicrosoftGraphMailboxInput, 'mailbox'> {
  /**
   * The draft to attach to.
   */
  readonly id: string;
  readonly attachment: MicrosoftGraphFileAttachmentInput;
  /**
   * Overrides the client's timeout per chunk PUT.
   */
  readonly timeout?: Maybe<Milliseconds>;
}

/**
 * Attaches a file of up to {@link MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_MAX_BYTES} to a draft through an
 * upload session, in {@link MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_CHUNK_BYTES} chunks. Requires `Mail.ReadWrite`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that uploads the attachment.
 * @throws {Error} When the file is larger than {@link MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_MAX_BYTES}.
 *
 * @see https://learn.microsoft.com/en-us/graph/outlook-large-attachments
 */
export function uploadMessageAttachment(context: MicrosoftGraphContext): (input: MicrosoftGraphUploadMessageAttachmentInput) => Promise<void> {
  const request = microsoftGraphRequest(context);
  const put = microsoftGraphUploadSessionPut(context);

  return async (input) => {
    const { attachment } = input;

    if (attachment.bytes.length > MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_MAX_BYTES) {
      throw new Error(`Attachment "${attachment.name}" is ${attachment.bytes.length} bytes; Outlook takes at most ${MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_MAX_BYTES}.`);
    }

    const session = await request<{ readonly uploadUrl: string }>({
      method: 'POST',
      path: `${microsoftGraphMessagePath(input)}/attachments/createUploadSession`,
      body: { AttachmentItem: { attachmentType: 'file', name: attachment.name, size: attachment.bytes.length, contentType: attachment.contentType ?? 'application/octet-stream' } }
    });

    await put({ uploadUrl: session.uploadUrl, bytes: attachment.bytes, chunkSize: MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_CHUNK_BYTES, timeout: input.timeout });
  };
}

/**
 * The result of one message in a move, copy or delete of several.
 */
export interface MicrosoftGraphMessageWriteResult {
  /**
   * The id that was given.
   */
  readonly id: string;
  readonly status: number;
  /**
   * After a move or copy: the message at its destination (its id is the new id unless immutable ids were asked for).
   */
  readonly message?: Maybe<MicrosoftGraphMessage>;
  readonly error?: Maybe<MicrosoftGraphErrorData>;
}

export interface MicrosoftGraphMessageRequestsInput {
  /**
   * The message ids, one per request, in the same order.
   */
  readonly ids: readonly string[];
  readonly requests: readonly MicrosoftGraphRequestInput[];
  /**
   * Waits between `$batch` retries of throttled items. Defaults to a real timer; a spec passes a fake.
   */
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
}

/**
 * Turns request inputs into `$batch` items keyed by their index.
 *
 * @param requests - The requests.
 * @returns The batch items.
 */
export function microsoftGraphBatchRequestItems(requests: readonly MicrosoftGraphRequestInput[]): MicrosoftGraphBatchRequestItem[] {
  return requests.map((x, index) => ({ id: String(index), method: x.method, url: microsoftGraphPathWithQuery(x.path, x.query), headers: x.headers, body: x.body }));
}

/**
 * Sends one request per message and returns a per-id result, in order. Several requests go through `$batch`
 * (20 per HTTP call); one id's failure does not fail the others, and throttled items are re-sent after
 * `Retry-After`. A single request is sent directly, its Graph error turned into its result.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that resolves one result per id.
 */
export function microsoftGraphMessageRequests(context: MicrosoftGraphContext): (input: MicrosoftGraphMessageRequestsInput) => Promise<MicrosoftGraphMessageWriteResult[]> {
  const batch = microsoftGraphBatch(context);
  const request = microsoftGraphRequest(context);

  return async (input) => {
    let results: MicrosoftGraphMessageWriteResult[];

    if (input.requests.length === 1) {
      results = [await microsoftGraphSingleMessageRequest(request, input.ids[0], input.requests[0])];
    } else {
      results = await microsoftGraphBatchMessageRequests(batch, input);
    }

    return results;
  };
}

async function microsoftGraphSingleMessageRequest(request: ReturnType<typeof microsoftGraphRequest>, id: string, input: MicrosoftGraphRequestInput): Promise<MicrosoftGraphMessageWriteResult> {
  let result: MicrosoftGraphMessageWriteResult;

  try {
    const message = await request<Maybe<MicrosoftGraphMessage>>(input);
    // fetchJson resolves an empty 2xx (a 202 / 204) as null; the status itself is not exposed
    result = { id, status: message?.id ? 201 : 204, ...(message?.id ? { message } : {}) };
  } catch (e) {
    if (e instanceof MicrosoftGraphError) {
      result = { id, status: e.status, error: e.data };
    } else {
      throw e;
    }
  }

  return result;
}

async function microsoftGraphBatchMessageRequests(batch: ReturnType<typeof microsoftGraphBatch>, input: MicrosoftGraphMessageRequestsInput): Promise<MicrosoftGraphMessageWriteResult[]> {
  const { responses } = await batch<Maybe<MicrosoftGraphMessage | { readonly error?: MicrosoftGraphErrorData }>>({ requests: microsoftGraphBatchRequestItems(input.requests), wait: input.wait });

  return responses.map((response, index) => {
    const id = input.ids[index];
    let result: MicrosoftGraphMessageWriteResult;

    if (isMicrosoftGraphBatchResponseOk(response)) {
      const message = response.body as Maybe<MicrosoftGraphMessage>;
      result = { id, status: response.status, ...(message?.id ? { message } : {}) };
    } else {
      result = { id, status: response.status, error: (response.body as Maybe<{ readonly error?: MicrosoftGraphErrorData }>)?.error ?? { code: 'BatchItemFailed' } };
    }

    return result;
  });
}

export interface MicrosoftGraphMoveMessagesInput extends MicrosoftGraphMailboxInput {
  readonly ids: readonly string[];
  readonly destination: string;
  readonly copy?: Maybe<boolean>;
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
}

/**
 * Moves or copies messages to a folder through `$batch`, with a per-id result. Requires `Mail.ReadWrite`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that resolves one result per id, in order.
 */
export function moveMessages(context: MicrosoftGraphContext): (input: MicrosoftGraphMoveMessagesInput) => Promise<MicrosoftGraphMessageWriteResult[]> {
  const send = microsoftGraphMessageRequests(context);
  return (input) => send({ ids: input.ids, requests: input.ids.map((id) => microsoftGraphMoveMessageRequest({ ...input, id })), wait: input.wait });
}

export interface MicrosoftGraphDeleteMessagesInput extends MicrosoftGraphMailboxInput {
  readonly ids: readonly string[];
  /**
   * Permanently deletes (`permanentDelete`) instead of moving to Deleted Items.
   */
  readonly hard?: Maybe<boolean>;
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
}

/**
 * Builds the requests {@link deleteMessages} sends: a move to {@link MICROSOFT_GRAPH_DELETED_ITEMS_FOLDER}
 * (recoverable), or `permanentDelete` with `hard`.
 *
 * A plain `DELETE` is not used: where it puts a message (Deleted Items or Recoverable Items) is not documented.
 *
 * @param input - The mailbox, ids and hard flag.
 * @returns One request per id.
 */
export function microsoftGraphDeleteMessagesRequests(input: Omit<MicrosoftGraphDeleteMessagesInput, 'wait'>): MicrosoftGraphRequestInput[] {
  return input.ids.map((id) => (input.hard ? microsoftGraphPermanentDeleteMessageRequest({ mailbox: input.mailbox, id }) : microsoftGraphMoveMessageRequest({ ...input, id, destination: MICROSOFT_GRAPH_DELETED_ITEMS_FOLDER })));
}

/**
 * Deletes messages through `$batch`, with a per-id result. Requires `Mail.ReadWrite`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that resolves one result per id, in order.
 */
export function deleteMessages(context: MicrosoftGraphContext): (input: MicrosoftGraphDeleteMessagesInput) => Promise<MicrosoftGraphMessageWriteResult[]> {
  const send = microsoftGraphMessageRequests(context);
  return (input) => send({ ids: input.ids, requests: microsoftGraphDeleteMessagesRequests(input), wait: input.wait });
}
