import { describe, expect, it } from 'vitest';
import OpenAI from 'openai';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { makeLlmFetchFake, type LlmFetchFakeAnswer } from '@dereekb/llm/test';
import { type LlmOpenAiChatClient } from './openai.chat';
import { makeLlmOpenAiStrategy } from './openai.strategy';

/**
 * `makeLlmOpenAiStrategy` over a REAL `openai` SDK client built the way a host builds one (the SDK's default
 * `maxRetries: 2`), with only its `fetch` faked: the per-request `maxRetries: 0` outranks the client's own setting, so
 * one call is one HTTP attempt. The control proves the same client resends a bare `create`.
 */

const GATEWAY_BASE_URL = 'https://gateway.test/v1';

/**
 * A failure the SDK retries by default; `retry-after-ms` keeps the control's two backoffs to 1 ms each.
 *
 * @param status - The HTTP status.
 * @returns The fake's answer.
 */
function retryableAnswer(status: number): LlmFetchFakeAnswer {
  return { status, body: { error: { message: 'upstream failed' } }, headers: { 'content-type': 'application/json', 'retry-after-ms': '1' } };
}

/**
 * A host-built client: SDK defaults (two retries), pointed at the fake.
 *
 * @param fetch - The fake's fetch.
 * @returns The client.
 */
function makeHostClient(fetch: ConfiguredFetch): OpenAI {
  return new OpenAI({ apiKey: 'sk-test', baseURL: GATEWAY_BASE_URL, fetch });
}

describe('makeLlmOpenAiStrategy() over a host-built openai client', () => {
  it('control: the client itself resends a bare create twice', async () => {
    const fake = makeLlmFetchFake(retryableAnswer(500));

    await expect(makeHostClient(fake.fetch).chat.completions.create({ model: 'vendor/model', messages: [{ role: 'user', content: 'hi' }] })).rejects.toHaveProperty('status', 500);
    expect(fake.requests).toHaveLength(3);
  });

  it.each([429, 500, 503])('sends one HTTP attempt per call on a %i', async (status) => {
    const fake = makeLlmFetchFake(retryableAnswer(status));
    const strategy = makeLlmOpenAiStrategy({ client: makeHostClient(fake.fetch) as unknown as LlmOpenAiChatClient, defaultModel: 'vendor/model' });

    await expect(strategy.complete({ prompt: 'hi', capability: 'X' })).rejects.toHaveProperty('status', status);
    expect(fake.requests).toHaveLength(1);
  });
});
