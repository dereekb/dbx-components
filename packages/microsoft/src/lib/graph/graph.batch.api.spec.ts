import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { MICROSOFT_GRAPH_BATCH_MAX_REQUESTS, type MicrosoftGraphBatchRequestItem, type MicrosoftGraphBatchResponseItem, chunkMicrosoftGraphBatchRequests, isMicrosoftGraphBatchResponseOk, microsoftGraphBatch } from './graph.batch.api';
import { microsoftGraphFactory } from './graph.factory';

interface WireBatchRequest {
  readonly requests: { readonly id: string; readonly url: string; readonly headers?: Record<string, string>; readonly dependsOn?: string[] }[];
}

/**
 * A fake `/$batch` endpoint: each POST is answered by `answer(round, requestIds)`, always with an outer 200.
 *
 * @param answer - Builds the per-item responses for one call.
 * @returns The context and the batch bodies sent.
 */
function fakeBatchGraph(answer: (call: number, body: WireBatchRequest) => MicrosoftGraphBatchResponseItem[]) {
  const sent: WireBatchRequest[] = [];
  const urls: string[] = [];

  const fetchHandler: FetchHandler = async (request) => {
    const body = (await request.json()) as WireBatchRequest;
    sent.push(body);
    urls.push(request.url);
    return new Response(JSON.stringify({ responses: answer(sent.length - 1, body) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });
  return { graphContext, sent, urls };
}

function deleteRequests(count: number): MicrosoftGraphBatchRequestItem[] {
  return Array.from({ length: count }, (_, i) => ({ id: String(i + 1), method: 'DELETE' as const, url: `/me/messages/m${i + 1}` }));
}

describe('chunkMicrosoftGraphBatchRequests()', () => {
  it('splits into chunks of 20 in order', () => {
    // models: json-batching "Batch size limitations" — at most 20 requests per $batch
    const chunks = chunkMicrosoftGraphBatchRequests(deleteRequests(45));
    expect(chunks.map((x) => x.length)).toEqual([MICROSOFT_GRAPH_BATCH_MAX_REQUESTS, MICROSOFT_GRAPH_BATCH_MAX_REQUESTS, 5]);
    expect(chunks[1][0].id).toBe('21');
  });

  it('rejects a repeated id and a dependsOn that crosses a chunk', () => {
    expect(() => chunkMicrosoftGraphBatchRequests([...deleteRequests(1), ...deleteRequests(1)])).toThrow(/more than once/);

    const crossing = deleteRequests(21).map((x) => (x.id === '21' ? { ...x, dependsOn: ['1'] } : x));
    expect(() => chunkMicrosoftGraphBatchRequests(crossing)).toThrow(/not in its chunk/);
  });
});

describe('microsoftGraphBatch()', () => {
  it('returns each item status in request order and never reads the outer 200 as success', async () => {
    // models: json-batching — responses may come back in any order, each with its own status; outer status 200
    const { graphContext, sent, urls } = fakeBatchGraph(() => [
      { id: '3', status: 404, body: { error: { code: 'ErrorItemNotFound', message: 'The specified object was not found in the store.' } } },
      { id: '1', status: 204 },
      { id: '2', status: 204 }
    ]);

    const result = await microsoftGraphBatch(graphContext)({ requests: deleteRequests(3) });

    expect(urls[0]).toBe('https://graph.microsoft.com/v1.0/$batch');
    expect(sent[0].requests.map((x) => x.url)).toEqual(['/me/messages/m1', '/me/messages/m2', '/me/messages/m3']);
    expect(result.responses.map((x) => [x.id, x.status])).toEqual([
      ['1', 204],
      ['2', 204],
      ['3', 404]
    ]);
    expect(result.responses.map(isMicrosoftGraphBatchResponseOk)).toEqual([true, true, false]);
    expect(result.retryRounds).toBe(0);
  });

  it('re-sends only the throttled items after their Retry-After', async () => {
    // models: throttling-limits — "each request in a batch is evaluated against throttling limits individually"; a 429 item carries Retry-After (seconds)
    const waits: number[] = [];
    const { graphContext, sent } = fakeBatchGraph((call, body) =>
      call === 0
        ? [
            { id: '1', status: 204 },
            { id: '2', status: 429, headers: { 'Retry-After': '7' }, body: { error: { code: 'ApplicationThrottled', message: 'Application is over its MailboxConcurrency limit.' } } },
            { id: '3', status: 429, headers: { 'Retry-After': '3' } }
          ]
        : body.requests.map((x) => ({ id: x.id, status: 204 }))
    );

    const result = await microsoftGraphBatch(graphContext)({ requests: deleteRequests(3), wait: async (ms) => waits.push(ms) });

    expect(waits).toEqual([7000]);
    expect(sent[1].requests.map((x) => x.id)).toEqual(['2', '3']);
    expect(result.responses.every(isMicrosoftGraphBatchResponseOk)).toBe(true);
    expect(result.retryRounds).toBe(1);
  });

  it('stops retrying after maxRetries and returns the 429', async () => {
    const { graphContext, sent } = fakeBatchGraph((_, body) => body.requests.map((x) => ({ id: x.id, status: 429, headers: { 'Retry-After': '1' } })));

    const result = await microsoftGraphBatch(graphContext)({ requests: deleteRequests(1), maxRetries: 2, wait: async () => undefined });

    expect(sent).toHaveLength(3);
    expect(result.responses[0].status).toBe(429);
  });

  it('returns the 429 at once when Retry-After is longer than maxRetryAfterSeconds', async () => {
    const { graphContext, sent } = fakeBatchGraph(() => [{ id: '1', status: 429, headers: { 'Retry-After': '300' } }]);

    const result = await microsoftGraphBatch(graphContext)({ requests: deleteRequests(1), wait: async () => undefined });

    expect(sent).toHaveLength(1);
    expect(result.responses[0].status).toBe(429);
  });

  it('reports a 424 for a request whose dependency failed, and re-sends it with a throttled dependency', async () => {
    // models: json-batching "Sequencing requests with the dependsOn property" — a failed dependency answers 424 Failed Dependency
    const requests: MicrosoftGraphBatchRequestItem[] = [
      { id: '1', method: 'POST', url: '/me/messages', body: { subject: 'draft' } },
      { id: '2', method: 'POST', url: '/me/messages/m1/send', dependsOn: ['1'] },
      { id: '3', method: 'DELETE', url: '/me/messages/gone' },
      { id: '4', method: 'POST', url: '/me/messages/gone/move', dependsOn: ['3'] }
    ];

    const { graphContext, sent } = fakeBatchGraph((call, body) =>
      call === 0
        ? [
            { id: '1', status: 429, headers: { 'Retry-After': '1' } },
            { id: '2', status: 424 },
            { id: '3', status: 404 },
            { id: '4', status: 424 }
          ]
        : body.requests.map((x) => ({ id: x.id, status: x.id === '1' ? 201 : 202 }))
    );

    const result = await microsoftGraphBatch(graphContext)({ requests, wait: async () => undefined });

    expect(sent[0].requests[0].headers?.['Content-Type']).toBe('application/json');
    expect(sent[0].requests[1].dependsOn).toEqual(['1']);
    // the 424 behind the throttled draft is re-sent with it; the 424 behind the real 404 is not
    expect(sent[1].requests.map((x) => x.id)).toEqual(['1', '2']);
    expect(result.responses.map((x) => x.status)).toEqual([201, 202, 404, 424]);
  });

  it('makes an absolute Graph URL relative', async () => {
    const { graphContext, sent } = fakeBatchGraph((_, body) => body.requests.map((x) => ({ id: x.id, status: 200 })));
    await microsoftGraphBatch(graphContext)({ requests: [{ id: 'a', method: 'GET', url: 'https://graph.microsoft.com/v1.0/me/messages?$skiptoken=x' }] });

    expect(sent[0].requests[0].url).toBe('/me/messages?$skiptoken=x');
  });
});
