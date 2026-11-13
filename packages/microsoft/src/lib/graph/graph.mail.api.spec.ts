import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { type MicrosoftGraphBatchResponseItem } from './graph.batch.api';
import { microsoftGraphFactory } from './graph.factory';
import {
  MICROSOFT_GRAPH_MESSAGE_DELTA_SELECT,
  MICROSOFT_GRAPH_MESSAGE_FILTER_EARLIEST,
  getMessageAttachmentContent,
  getMessageMime,
  getMessages,
  listMessages,
  microsoftGraphGetMessageAttachmentContentRequest,
  microsoftGraphMessageListFilter,
  microsoftGraphMessagesDeltaRequest,
  microsoftGraphSearchMessagesRequest
} from './graph.mail.api';

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
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('microsoftGraphMessageListFilter()', () => {
  it('puts receivedDateTime first, ahead of the other filters', () => {
    // models: M-j (user-list-messages "Using filter and orderby in the same query") — the $orderby property must lead the $filter
    const filter = microsoftGraphMessageListFilter({ since: new Date('2026-01-01T00:00:00.000Z'), until: new Date('2026-02-01T12:30:00Z'), from: 'ada@example.com', unread: true, hasAttachments: true });
    expect(filter).toBe("receivedDateTime ge 2026-01-01T00:00:00Z and receivedDateTime lt 2026-02-01T12:30:00Z and from/emailAddress/address eq 'ada@example.com' and isRead eq false and hasAttachments eq true");
  });

  it('adds the earliest bound when only non-date filters are set', () => {
    const filter = microsoftGraphMessageListFilter({ from: "o'brien@example.com" });
    expect(filter).toBe(`receivedDateTime ge ${MICROSOFT_GRAPH_MESSAGE_FILTER_EARLIEST} and from/emailAddress/address eq 'o''brien@example.com'`);
  });

  it('returns undefined when no filter is set', () => {
    expect(microsoftGraphMessageListFilter({})).toBeUndefined();
  });

  it('rejects an invalid date', () => {
    expect(() => microsoftGraphMessageListFilter({ since: new Date('nope') })).toThrow(TypeError);
  });
});

describe('listMessages()', () => {
  it('lists a shared mailbox folder newest first with immutable ids', async () => {
    const { graphContext, requests } = recordingGraph(() => jsonResponse({ value: [] }));
    await listMessages(graphContext)({ mailbox: 'shared@example.com', folder: 'inbox', unread: true, top: 10, select: 'id,subject' });

    const url = new URL(requests[0].url);
    expect(url.pathname).toBe('/v1.0/users/shared%40example.com/mailFolders/inbox/messages');
    expect(url.searchParams.get('$orderby')).toBe('receivedDateTime desc');
    expect(url.searchParams.get('$filter')).toBe(`receivedDateTime ge ${MICROSOFT_GRAPH_MESSAGE_FILTER_EARLIEST} and isRead eq false`);
    expect(url.searchParams.get('$top')).toBe('10');
    expect(url.searchParams.get('$select')).toBe('id,subject');
    // models: M-e (outlook-immutable-id) — the Prefer header asks for ids that survive a move
    expect(requests[0].headers.get('Prefer')).toBe('IdType="ImmutableId"');
  });

  it('sends no Prefer header when immutable ids are turned off and has no $filter without filters', async () => {
    const { graphContext, requests } = recordingGraph(() => jsonResponse({ value: [] }));
    await listMessages(graphContext)({ immutableIds: false });

    const url = new URL(requests[0].url);
    expect(url.pathname).toBe('/v1.0/me/messages');
    expect(url.searchParams.has('$filter')).toBe(false);
    expect(requests[0].headers.get('Prefer')).toBeNull();
  });
});

describe('microsoftGraphSearchMessagesRequest()', () => {
  it('quotes the query and keeps the mailbox', () => {
    const request = microsoftGraphSearchMessagesRequest({ query: 'say "hi"', mailbox: 'shared@example.com' });
    expect(request.path).toBe('/users/shared%40example.com/messages');
    expect(request.query['$search']).toBe(String.raw`"say \"hi\""`);
  });
});

describe('getMessageMime()', () => {
  it('reads $value through the raw path', async () => {
    // models: M-h (outlook-get-mime-message) — $value answers the RFC 822 text, not JSON
    const mime = 'From: a@example.com\r\nSubject: test\r\n\r\nbody';
    const { graphContext, requests } = recordingGraph(() => new Response(mime, { status: 200, headers: { 'Content-Type': 'text/plain' } }));
    const response = await getMessageMime(graphContext)({ id: 'm/1' });

    expect(new URL(requests[0].url).pathname).toBe('/v1.0/me/messages/m%2F1/$value');
    expect(response.text()).toBe(mime);
  });
});

describe('getMessages()', () => {
  it('returns the messages in id order with per-id errors, re-sending a throttled item', async () => {
    let call = 0;
    const { graphContext, requests } = recordingGraph(async (request) => {
      const body = (await request.json()) as { requests: { id: string; url: string; headers?: Record<string, string> }[] };
      let responses: MicrosoftGraphBatchResponseItem[];

      if (call === 0) {
        // models: json-batching — responses come back in any order; each item carries its own status (M-l)
        responses = [
          { id: '2', status: 404, body: { error: { code: 'ErrorItemNotFound', message: 'The specified object was not found in the store.' } } },
          { id: '0', status: 200, body: { id: 'a', subject: 'A' } },
          { id: '1', status: 429, headers: { 'Retry-After': '1' }, body: { error: { code: 'ApplicationThrottled' } } }
        ];
      } else {
        responses = body.requests.map((x) => ({ id: x.id, status: 200, body: { id: 'b', subject: 'B' } }));
      }

      call += 1;
      return jsonResponse({ responses });
    });

    const waits: number[] = [];
    const items = await getMessages(graphContext)({ ids: ['a', 'b', 'c'], format: 'html', wait: async (ms) => waits.push(ms) });

    expect(items.map((x) => [x.id, x.status])).toEqual([
      ['a', 200],
      ['b', 200],
      ['c', 404]
    ]);
    expect(items[1].message?.subject).toBe('B');
    expect(items[2].error?.code).toBe('ErrorItemNotFound');
    expect(waits).toEqual([1000]);

    const first = (await requests[0].json()) as { requests: { url: string; headers?: Record<string, string> }[] };
    expect(first.requests[0].url).toContain('/me/messages/a?');
    expect(first.requests[0].headers?.['Prefer']).toBe('IdType="ImmutableId", outlook.body-content-type="html"');
  });
});

describe('microsoftGraphMessagesDeltaRequest()', () => {
  it('starts a folder round with a receivedDateTime lower bound and the page size in Prefer', () => {
    // models: M-k (delta-query-messages) — per-folder; $filter only on receivedDateTime; page size via odata.maxpagesize
    const request = microsoftGraphMessagesDeltaRequest({ folder: 'inbox', mailbox: 'shared@example.com', since: new Date('2026-10-01T00:00:00Z'), pageSize: 20 });
    expect(request.path).toBe('/users/shared%40example.com/mailFolders/inbox/messages/delta');
    expect(request.query).toEqual({ $select: MICROSOFT_GRAPH_MESSAGE_DELTA_SELECT, $filter: 'receivedDateTime ge 2026-10-01T00:00:00Z' });
    expect(request.headers).toEqual({ Prefer: 'IdType="ImmutableId", odata.maxpagesize=20' });
  });

  it('resumes from a stored link without adding a query', () => {
    const link = 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=d1';
    const request = microsoftGraphMessagesDeltaRequest({ folder: 'inbox', link, since: new Date('2026-10-01T00:00:00Z'), immutableIds: false });
    expect(request.path).toBe(link);
    expect(request.query).toEqual({});
    expect(request.headers).toEqual({ Prefer: 'odata.maxpagesize=50' });
  });
});

describe('getMessageAttachmentContent()', () => {
  it('reads the attachment bytes through $value', async () => {
    const { graphContext, requests } = recordingGraph(() => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'application/pdf' } }));
    const response = await getMessageAttachmentContent(graphContext)({ id: 'm1', attachmentId: 'a/1' });
    expect(new URL(requests[0].url).pathname).toBe('/v1.0/me/messages/m1/attachments/a%2F1/$value');
    expect([...response.body]).toEqual([1, 2, 3]);
  });
});

describe('microsoftGraphGetMessageAttachmentContentRequest()', () => {
  it('encodes the message and attachment ids in the $value path', () => {
    // models: https://learn.microsoft.com/en-us/graph/api/attachment-get#example-6-get-the-raw-contents-of-a-file-attachment-on-a-message
    const request = microsoftGraphGetMessageAttachmentContentRequest({ mailbox: 'shared@example.com', id: 'm/1', attachmentId: 'a=/1' });
    expect(request.method).toBe('GET');
    expect(request.path).toBe('/users/shared%40example.com/messages/m%2F1/attachments/a%3D%2F1/$value');
  });
});
