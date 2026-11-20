import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeLlmFetchFake, readLlmFetchFakeHeader } from '@dereekb/llm/test';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { makeLlmZenmuxGenerationBillReader } from './zenmux.generation.bill';

// `management/generation` bodies, trimmed to the fields read.
const DEEPSEEK_ID = '59757e87e11143d29caa2300fca28e45';
const DEEPSEEK_BODY = JSON.stringify({ success: true, data: { generationId: DEEPSEEK_ID, model: 'deepseek/deepseek-v4.1-flash', usage: 0.000287775, ratingResponses: { billAmount: 0.000287775, discountAmount: 0.000287775, originAmount: 0.00057555 } } });
const HAIKU_BODY = JSON.stringify({ success: true, data: { model: 'anthropic/claude-haiku-5.5', ratingResponses: { billAmount: 0.0003534, discountAmount: 0, originAmount: 0.0003534 } } });
const NOT_FOUND_BODY = '{"success":false,"message":"Not Found","data":null}';
const REJECTED_BODY = '{"success":false,"message":"Invalid API key","data":null}';

describe('makeLlmZenmuxGenerationBillReader()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the bill, the list amount and the discount, on the given key', async () => {
    const seam = makeLlmFetchFake({ status: 200, body: DEEPSEEK_BODY });
    const read = await makeLlmZenmuxGenerationBillReader({ apiKey: ' payg-key ', fetch: seam.fetch }).read(DEEPSEEK_ID);

    expect(read).toEqual({ status: 'billed', bill: { generationId: DEEPSEEK_ID, billed: 0.000287775, listed: 0.00057555, discount: 0.000287775 } });
    expect(seam.requests.map((request) => ({ url: request.url, auth: readLlmFetchFakeHeader(request, 'Authorization') }))).toEqual([{ url: `https://zenmux.ai/api/v1/management/generation?id=${DEEPSEEK_ID}`, auth: 'Bearer payg-key' }]);
  });

  it('keeps the maximal and minimal bill key order and bytes (pin)', async () => {
    const full = await makeLlmZenmuxGenerationBillReader({ apiKey: 'k', fetch: makeLlmFetchFake({ status: 200, body: DEEPSEEK_BODY }).fetch }).read(DEEPSEEK_ID);
    const bare = await makeLlmZenmuxGenerationBillReader({ apiKey: 'k', fetch: makeLlmFetchFake({ status: 200, body: JSON.stringify({ success: true, data: { ratingResponses: { billAmount: '0.0002', discountAmount: null, originAmount: null } } }) }).fetch }).read('b1');

    expect(JSON.stringify(full)).toBe(`{"status":"billed","bill":{"generationId":"${DEEPSEEK_ID}","billed":0.000287775,"listed":0.00057555,"discount":0.000287775}}`);
    expect(JSON.stringify(bare)).toBe('{"status":"billed","bill":{"generationId":"b1","billed":0.0002}}');
    expect(bare.status === 'billed' ? Object.keys(bare.bill) : []).toEqual(['generationId', 'billed']);
  });

  it('reads an undiscounted slug as billed == listed', async () => {
    const read = await makeLlmZenmuxGenerationBillReader({ apiKey: 'k', fetch: makeLlmFetchFake({ status: 200, body: HAIKU_BODY }).fetch }).read('h1');

    expect(read).toEqual({ status: 'billed', bill: { generationId: 'h1', billed: 0.0003534, listed: 0.0003534, discount: 0 } });
  });

  it('reads a 404 as PENDING (a call bills minutes after it is made), never as a failure', async () => {
    const read = await makeLlmZenmuxGenerationBillReader({ apiKey: 'k', fetch: makeLlmFetchFake({ status: 404, body: NOT_FOUND_BODY }).fetch }).read('fresh');

    expect(read).toEqual({ status: 'pending', generationId: 'fresh', detail: 'Not Found' });
  });

  it('reads a 200 with no rating yet as pending too', async () => {
    const read = await makeLlmZenmuxGenerationBillReader({ apiKey: 'k', fetch: makeLlmFetchFake({ status: 200, body: JSON.stringify({ success: true, data: { model: 'x' } }) }).fetch }).read('g');

    expect(read).toEqual({ status: 'pending', generationId: 'g', detail: 'no rating on the generation yet' });
  });

  it("reports a refused key as FAILED, quoting the provider's own words", async () => {
    const read = await makeLlmZenmuxGenerationBillReader({ apiKey: 'subscription-key', fetch: makeLlmFetchFake({ status: 403, body: REJECTED_BODY }).fetch }).read('g');

    expect(read).toEqual({ status: 'failed', generationId: 'g', detail: 'HTTP 403: Invalid API key' });
  });

  it('never throws: a transport error and an unparseable body are failed reads', async () => {
    const throwing: ConfiguredFetch = async () => {
      throw new Error('fetch failed');
    };

    expect(await makeLlmZenmuxGenerationBillReader({ apiKey: 'k', fetch: throwing }).read('g')).toEqual({ status: 'failed', generationId: 'g', detail: 'fetch failed' });
    expect(await makeLlmZenmuxGenerationBillReader({ apiKey: 'k', fetch: makeLlmFetchFake({ status: 200, body: '<html>' }).fetch }).read('g')).toEqual({ status: 'failed', generationId: 'g', detail: 'unparseable response body' });
  });

  it('honours a base URL override and encodes the id', async () => {
    const seam = makeLlmFetchFake({ status: 404, body: NOT_FOUND_BODY });
    await makeLlmZenmuxGenerationBillReader({ apiKey: 'k', baseUrl: 'https://eu.zenmux.ai/api/v1/', fetch: seam.fetch }).read('a b');

    expect(seam.requests[0]?.url).toBe('https://eu.zenmux.ai/api/v1/management/generation?id=a%20b');
  });

  it('reads as FAILED, never a throw, on an engine without AbortSignal.timeout', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      throw new TypeError('AbortSignal.timeout is not a function');
    });

    const read = await makeLlmZenmuxGenerationBillReader({ apiKey: 'k', fetch: makeLlmFetchFake({ status: 200, body: HAIKU_BODY }).fetch }).read('g');

    expect(read).toEqual({ status: 'failed', generationId: 'g', detail: 'AbortSignal.timeout is not a function' });
  });
});
