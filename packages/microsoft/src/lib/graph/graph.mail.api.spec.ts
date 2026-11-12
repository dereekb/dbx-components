import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { type MicrosoftGraphBatchResponseItem } from './graph.batch.api';
import { microsoftGraphFactory } from './graph.factory';
import { MICROSOFT_GRAPH_MESSAGE_FILTER_EARLIEST, getMessageMime, getMessages, listMessages, microsoftGraphMessageListFilter, microsoftGraphSearchMessagesRequest } from './graph.mail.api';

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
