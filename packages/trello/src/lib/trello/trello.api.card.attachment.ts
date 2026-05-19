import { type Maybe } from '@dereekb/util';
import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloAttachmentId, type TrelloCardId } from '../trello.type';
import { type AddAttachmentToCardBody, type TrelloAttachment } from './trello.api.card.attachment.type';

export interface ListCardAttachmentsInput {
  readonly cardId: TrelloCardId;
  /**
   * Comma-separated list of attachment fields to return, or `all`.
   */
  readonly fields?: string;
  /**
   * Optional filter (e.g. `cover`).
   */
  readonly filter?: string;
}

export type ListCardAttachmentsFunction = (input: ListCardAttachmentsInput) => Promise<ReadonlyArray<TrelloAttachment>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-attachments-get.
 *
 * @param context - The Trello API context.
 * @returns Lists attachments on a card.
 */
export function listCardAttachments(context: TrelloContext): ListCardAttachmentsFunction {
  return (input) => {
    const { cardId, ...query } = input;
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/cards/${cardId}/attachments?${queryString}`, 'GET');
  };
}

export interface GetCardAttachmentInput {
  readonly cardId: TrelloCardId;
  readonly attachmentId: TrelloAttachmentId;
  /**
   * Comma-separated list of attachment fields to return, or `all`.
   */
  readonly fields?: string;
}

export type GetCardAttachmentFunction = (input: GetCardAttachmentInput) => Promise<TrelloAttachment>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-attachments-idattachment-get.
 *
 * @param context - The Trello API context.
 * @returns Retrieves a single attachment on a card.
 */
export function getCardAttachment(context: TrelloContext): GetCardAttachmentFunction {
  return (input) => {
    const { cardId, attachmentId, ...query } = input;
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/cards/${cardId}/attachments/${attachmentId}?${queryString}`, 'GET');
  };
}

export interface AddAttachmentToCardInput extends AddAttachmentToCardBody {
  readonly cardId: TrelloCardId;
}

export type AddAttachmentToCardFunction = (input: AddAttachmentToCardInput) => Promise<TrelloAttachment>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-attachments-post.
 *
 * Supports both file uploads (multipart/form-data) and url-only attachments. Pass exactly one of `file` or `url`.
 *
 * @param context - The Trello API context.
 * @returns Adds an attachment (file or url) to a card.
 */
export function addAttachmentToCard(context: TrelloContext): AddAttachmentToCardFunction {
  return async (input) => {
    const { cardId, name, file, url, setCover, mimeType } = input;

    if ((file && url) || (!file && !url)) {
      throw new Error('addAttachmentToCard requires exactly one of `file` or `url`.');
    }

    const formData = new FormData();

    if (name) {
      formData.append('name', name);
    }

    if (setCover !== undefined) {
      formData.append('setCover', setCover ? 'true' : 'false');
    }

    if (file) {
      const fileMimeType = file.mimeType ?? 'application/octet-stream';
      const blob = new Blob([file.content], { type: fileMimeType });
      formData.append('file', blob, file.fileName);
    } else if (url) {
      formData.append('url', url);

      if (mimeType) {
        formData.append('mimeType', mimeType);
      }
    }

    // Clear the configured fetch's default `Content-Type: application/json` header so the
    // runtime can set `multipart/form-data; boundary=...` itself from the FormData body.
    const response = await context.fetch(`/cards/${cardId}/attachments`, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': '' }
    });

    return (await response.json()) as TrelloAttachment;
  };
}

export interface DeleteAttachmentFromCardInput {
  readonly cardId: TrelloCardId;
  readonly attachmentId: TrelloAttachmentId;
}

export type DeleteAttachmentFromCardFunction = (input: DeleteAttachmentFromCardInput) => Promise<void>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-attachments-idattachment-delete.
 *
 * @param context - The Trello API context.
 * @returns Removes an attachment from a card.
 */
export function deleteAttachmentFromCard(context: TrelloContext): DeleteAttachmentFromCardFunction {
  return async (input) => {
    await context.fetchJson(`/cards/${input.cardId}/attachments/${input.attachmentId}`, 'DELETE');
  };
}

/**
 * Result returned by {@link downloadCardAttachment}. The attachment metadata is included so callers
 * can correlate the bytes with the original filename, mime type, and size without an extra request.
 */
export interface DownloadCardAttachmentResult {
  readonly attachment: TrelloAttachment;
  readonly response: Response;
  /**
   * Reads the response body as an ArrayBuffer.
   */
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
  /**
   * Reads the response body as a Blob (typed with the attachment's mime type when available).
   */
  readonly blob: () => Promise<Blob>;
  /**
   * Reads the response body as text.
   */
  readonly text: () => Promise<string>;
}

export interface DownloadCardAttachmentInput {
  readonly cardId: TrelloCardId;
  readonly attachmentId: TrelloAttachmentId;
  /**
   * Optional pre-fetched attachment metadata. When provided, skips the extra GET request used to resolve the file name.
   */
  readonly attachment?: TrelloAttachment;
}

export type DownloadCardAttachmentFunction = (input: DownloadCardAttachmentInput) => Promise<DownloadCardAttachmentResult>;

/**
 * Downloads the raw bytes of a card attachment via the authenticated Trello download endpoint:
 * `GET /cards/{id}/attachments/{idAttachment}/download/{filename}`.
 *
 * The configured Trello fetch automatically attaches the OAuth `Authorization` header required by Trello
 * for private file downloads.
 *
 * @param context - The Trello API context.
 * @returns Downloads the attachment bytes along with its metadata.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/file-attachments/
 */
export function downloadCardAttachment(context: TrelloContext): DownloadCardAttachmentFunction {
  const getAttachment = getCardAttachment(context);

  return async (input) => {
    const attachment = input.attachment ?? (await getAttachment({ cardId: input.cardId, attachmentId: input.attachmentId }));
    const fileName = attachment.fileName || attachment.name;
    const response = await context.fetch(`/cards/${input.cardId}/attachments/${input.attachmentId}/download/${encodeURIComponent(fileName)}`, { method: 'GET' });

    const mimeType: Maybe<string> = attachment.mimeType;

    return {
      attachment,
      response,
      arrayBuffer: () => response.arrayBuffer(),
      blob: async () => {
        const buffer = await response.arrayBuffer();
        return new Blob([buffer], mimeType ? { type: mimeType } : undefined);
      },
      text: () => response.text()
    };
  };
}
