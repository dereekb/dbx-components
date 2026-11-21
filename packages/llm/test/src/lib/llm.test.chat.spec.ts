import { describe, expect, it } from 'vitest';
import { type RawLlmUsage } from '@dereekb/llm';
import { DEFAULT_LLM_OPENAI_CHAT_CLIENT_FAKE_REPLY, makeLlmOpenAiChatClientFake, type LlmOpenAiChatClientFakeCompletion } from './llm.test.chat';

/**
 * A structural copy of `LlmOpenAiChatClient` (`@dereekb/llm/openai`), which `/test` may not import. The real drift check
 * is the openai / openrouter strategy specs passing the fake where the real interface is expected.
 */
interface ChatClientShape {
  readonly chat: { readonly completions: { create(body: { readonly model: string }, options?: { readonly signal?: AbortSignal; readonly timeout?: number; readonly maxRetries?: number }): Promise<LlmOpenAiChatClientFakeCompletion> } };
}

const USAGE: RawLlmUsage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };

describe('makeLlmOpenAiChatClientFake()', () => {
  it('should answer the default reply and omit every unset field', async () => {
    const fake = makeLlmOpenAiChatClientFake();
    const completion = await fake.client.chat.completions.create({ model: 'm', messages: [] });

    expect(completion).toEqual({ choices: [{ message: { content: DEFAULT_LLM_OPENAI_CHAT_CLIENT_FAKE_REPLY } }] });
  });

  it('should carry the configured reply, id, model, provider, usage and finish reasons', async () => {
    const fake = makeLlmOpenAiChatClientFake({ reply: 'hello', id: 'gen-1', model: 'vendor/model', provider: 'Upstream', usage: USAGE, finishReason: 'stop', nativeFinishReason: 'end_turn' });
    const completion = await fake.client.chat.completions.create({ model: 'm', messages: [] });

    expect(completion).toEqual({ choices: [{ message: { content: 'hello' }, finish_reason: 'stop', native_finish_reason: 'end_turn' }], id: 'gen-1', model: 'vendor/model', provider: 'Upstream', usage: USAGE });
  });

  it('should omit model and usage when includeModel / includeUsage is false', async () => {
    const fake = makeLlmOpenAiChatClientFake({ model: 'vendor/model', usage: USAGE, includeModel: false, includeUsage: false });
    const completion = await fake.client.chat.completions.create({ model: 'm', messages: [] });

    expect(completion).toEqual({ choices: [{ message: { content: DEFAULT_LLM_OPENAI_CHAT_CLIENT_FAKE_REPLY } }] });
  });

  it('should answer a configured completion verbatim', async () => {
    const given: LlmOpenAiChatClientFakeCompletion = { choices: [{ message: { content: 'ok' } }], model: 'x' };
    const fake = makeLlmOpenAiChatClientFake({ completion: given, reply: 'ignored' });

    expect(await fake.client.chat.completions.create({ model: 'm', messages: [] })).toBe(given);
  });

  it('should record every body and options, recording {} when a call passes no options', async () => {
    const fake = makeLlmOpenAiChatClientFake();
    const signal = new AbortController().signal;

    await fake.client.chat.completions.create({ model: 'a', messages: [{ role: 'user', content: 'hi' }] }, { signal, timeout: 1000, maxRetries: 0 });
    await fake.client.chat.completions.create({ model: 'b', messages: [] });

    expect(fake.bodies).toEqual([
      { model: 'a', messages: [{ role: 'user', content: 'hi' }] },
      { model: 'b', messages: [] }
    ]);
    expect(fake.options).toEqual([{ signal, timeout: 1000, maxRetries: 0 }, {}]);
  });

  it('should be assignable to the chat client surface', () => {
    const client: ChatClientShape = makeLlmOpenAiChatClientFake().client;
    expect(client.chat.completions.create).toBeTypeOf('function');
  });
});
