import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { microsoftGraphFactory } from './graph.factory';
import {
  MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_CHUNK_BYTES,
  MicrosoftGraphMessageNotDraftError,
  createDraftMessage,
  deleteMessages,
  microsoftGraphCreateDraftRequest,
  microsoftGraphMessageResponseAction,
  microsoftGraphOutgoingMessage,
  microsoftGraphRespondToMessageRequest,
  microsoftGraphSendMailRequest,
  moveMessages,
  updateDraftMessage,
  uploadMessageAttachment
} from './graph.mail.write.api';
import { microsoftGraphUploadChunkRanges, microsoftGraphUploadContentRange } from './graph.upload.api';

function recordingGraph(answer: (request: Request) => Promise<Response> | Response) {
  const requests: Request[] = [];
  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request.clone());
    return answer(request);
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });
  return { graphContext, requests };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('microsoftGraphOutgoingMessage()', () => {
  it('sends only the given fields, recipients as emailAddress objects and attachments as base64', () => {
    const message = microsoftGraphOutgoingMessage({ subject: 'Hi', to: ['ada@example.com'], from: 'shared@example.com', attachments: [{ name: 'a.txt', contentType: 'text/plain', bytes: new TextEncoder().encode('hello') }] });

    expect(message).toEqual({
      subject: 'Hi',
      toRecipients: [{ emailAddress: { address: 'ada@example.com' } }],
      from: { emailAddress: { address: 'shared@example.com' } },
      attachments: [{ '@odata.type': '#microsoft.graph.fileAttachment', name: 'a.txt', contentType: 'text/plain', contentBytes: 'aGVsbG8=' }]
    });
  });

  it('refuses an inline attachment of 3 MB or more', () => {
    expect(() => microsoftGraphOutgoingMessage({ attachments: [{ name: 'big.bin', bytes: new Uint8Array(3 * 1024 * 1024) }] })).toThrow(/upload it to a draft/i);
  });
});

describe('createDraftMessage()', () => {
  it('posts the draft with the immutable-id Prefer header', async () => {
    // models: M-a (user-post-messages) — 201 with the draft
    const { graphContext, requests } = recordingGraph(() => jsonResponse({ id: 'draft-1', isDraft: true }, 201));
    const draft = await createDraftMessage(graphContext)({ message: { subject: 'Hi', body: { contentType: 'text', content: 'x' }, to: ['ada@example.com'] } });

    expect(draft.id).toBe('draft-1');
    expect(requests[0].method).toBe('POST');
    expect(new URL(requests[0].url).pathname).toBe('/v1.0/me/messages');
    // models: M-e (outlook-immutable-id)
    expect(requests[0].headers.get('Prefer')).toBe('IdType="ImmutableId"');
  });

  it('builds the request for a shared mailbox without the Prefer header when immutable ids are off', () => {
    const request = microsoftGraphCreateDraftRequest({ mailbox: 'shared@example.com', immutableIds: false, message: { subject: 'Hi' } });
    expect(request.path).toBe('/users/shared%40example.com/messages');
    expect(request.headers).toBeUndefined();
  });
});

describe('updateDraftMessage()', () => {
  it('refuses a message that is no longer a draft without sending the PATCH', async () => {
    // models: M-b (message-update) — only a draft's recipients, subject and body change
    const { graphContext, requests } = recordingGraph(() => jsonResponse({ id: 'm1', isDraft: false }));
    const error = await updateDraftMessage(graphContext)({ id: 'm1', message: { subject: 'New' } }).catch((e) => e);

    expect(error).toBeInstanceOf(MicrosoftGraphMessageNotDraftError);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(new URL(requests[0].url).searchParams.get('$select')).toBe('id,isDraft');
  });

  it('patches a draft with only the changed fields', async () => {
    const { graphContext, requests } = recordingGraph((request) => jsonResponse(request.method === 'GET' ? { id: 'd1', isDraft: true } : { id: 'd1', isDraft: true, subject: 'New' }));
    await updateDraftMessage(graphContext)({ id: 'd1', message: { subject: 'New' } });

    expect(requests[1].method).toBe('PATCH');
    expect(await requests[1].json()).toEqual({ subject: 'New' });
  });
});

describe('microsoftGraphSendMailRequest()', () => {
  it('posts to the shared mailbox and can skip Sent Items', () => {
    const request = microsoftGraphSendMailRequest({ mailbox: 'shared@example.com', saveToSentItems: false, message: { subject: 'Hi', to: ['ada@example.com'] } });
    expect(request.path).toBe('/users/shared%40example.com/sendMail');
    expect(request.body).toEqual({ message: { subject: 'Hi', toRecipients: [{ emailAddress: { address: 'ada@example.com' } }] }, saveToSentItems: false });
  });
});

describe('microsoftGraphRespondToMessageRequest()', () => {
  it('names the draft actions createReply / createReplyAll / createForward', () => {
    expect(microsoftGraphMessageResponseAction('reply', false)).toBe('reply');
    expect(microsoftGraphMessageResponseAction('replyAll', true)).toBe('createReplyAll');
    expect(microsoftGraphMessageResponseAction('forward', true)).toBe('createForward');
  });

  it('rejects a comment together with a message body', () => {
    // models: M-d (message-reply) — "Specifying both returns HTTP 400"
    expect(() => microsoftGraphRespondToMessageRequest({ id: 'm1', kind: 'reply', comment: 'Thanks', message: { body: { contentType: 'text', content: 'x' } } })).toThrow(/not both/);
  });

  it('puts a forward recipient in the message and the comment at the top level', () => {
    const request = microsoftGraphRespondToMessageRequest({ id: 'm1', kind: 'forward', comment: 'FYI', message: { to: ['grace@example.com'] } });
    expect(request.path).toBe('/me/messages/m1/forward');
    expect(request.headers).toBeUndefined();
    expect(request.body).toEqual({ comment: 'FYI', message: { toRecipients: [{ emailAddress: { address: 'grace@example.com' } }] } });
  });
});

describe('deleteMessages()', () => {
  it('moves to deleteditems through $batch and reports each id, including a partial failure', async () => {
    const { graphContext, requests } = recordingGraph(async (request) => {
      const body = (await request.json()) as { requests: { id: string }[] };
      // models: json-batching — the outer call answers 200; each item has its own status
      return jsonResponse({
        responses: [
          { id: '1', status: 404, body: { error: { code: 'ErrorItemNotFound', message: 'Not found.' } } },
          { id: '0', status: 201, body: { id: 'a-deleted' } }
        ].filter((x) => body.requests.some((r) => r.id === x.id))
      });
    });

    const results = await deleteMessages(graphContext)({ ids: ['a', 'b'] });
    const sent = (await requests[0].json()) as { requests: { url: string; body: unknown; headers: Record<string, string> }[] };

    expect(new URL(requests[0].url).pathname).toBe('/v1.0/$batch');
    expect(sent.requests[0].url).toBe('/me/messages/a/move');
    expect(sent.requests[0].body).toEqual({ destinationId: 'deleteditems' });
    expect(sent.requests[0].headers['Prefer']).toBe('IdType="ImmutableId"');
    expect(results).toEqual([
      { id: 'a', status: 201, message: { id: 'a-deleted' } },
      { id: 'b', status: 404, error: { code: 'ErrorItemNotFound', message: 'Not found.' } }
    ]);
  });

  it('permanently deletes one id directly with --hard and turns its Graph error into the result', async () => {
    // models: M-g (message-permanentdelete) — POST …/permanentDelete
    const { graphContext, requests } = recordingGraph(() => jsonResponse({ error: { code: 'ErrorItemNotFound', message: 'Not found.' } }, 404));
    const results = await deleteMessages(graphContext)({ ids: ['a'], hard: true });

    expect(new URL(requests[0].url).pathname).toBe('/v1.0/me/messages/a/permanentDelete');
    expect(results).toEqual([{ id: 'a', status: 404, error: { code: 'ErrorItemNotFound', message: 'Not found.' } }]);
  });
});

describe('moveMessages()', () => {
  it('moves one message directly and returns it at its destination', async () => {
    // models: M-e (message-move) — 201 with the moved message
    const { graphContext, requests } = recordingGraph(() => jsonResponse({ id: 'a' }, 201));
    const results = await moveMessages(graphContext)({ ids: ['a'], destination: 'archive' });

    expect(new URL(requests[0].url).pathname).toBe('/v1.0/me/messages/a/move');
    expect(results).toEqual([{ id: 'a', status: 201, message: { id: 'a' } }]);
  });
});

describe('upload sessions', () => {
  it('splits a file into in-order ranges', () => {
    expect(microsoftGraphUploadChunkRanges(10, 4)).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
      { start: 8, end: 9 }
    ]);
    expect(microsoftGraphUploadChunkRanges(0, 4)).toEqual([]);
    expect(microsoftGraphUploadContentRange({ start: 4, end: 7 }, 10)).toBe('bytes 4-7/10');
    expect(() => microsoftGraphUploadChunkRanges(10, 0)).toThrow();
  });

  it('uploads a large attachment in chunks without an Authorization header', async () => {
    // models: outlook-large-attachments — createUploadSession, then chunk PUTs to the pre-authenticated uploadUrl
    const size = MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_CHUNK_BYTES + 10;
    const { graphContext, requests } = recordingGraph((request) => (request.method === 'POST' ? jsonResponse({ uploadUrl: 'https://outlook.office.com/api/v2.0/upload/abc' }) : jsonResponse(null, 201)));
    await uploadMessageAttachment(graphContext)({ id: 'd1', attachment: { name: 'big.bin', bytes: new Uint8Array(size) } });

    expect(new URL(requests[0].url).pathname).toBe('/v1.0/me/messages/d1/attachments/createUploadSession');
    expect(await requests[0].json()).toEqual({ AttachmentItem: { attachmentType: 'file', name: 'big.bin', size, contentType: 'application/octet-stream' } });
    expect(requests.slice(1).map((x) => [x.method, x.headers.get('Content-Range'), x.headers.get('Authorization')])).toEqual([
      ['PUT', `bytes 0-${MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_CHUNK_BYTES - 1}/${size}`, null],
      ['PUT', `bytes ${MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_CHUNK_BYTES}-${size - 1}/${size}`, null]
    ]);
  });
});
