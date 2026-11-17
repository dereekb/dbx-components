import { describe, expect, it } from 'vitest';
import { type LlmRequest } from '@dereekb/llm';
import { makeScriptedLlmStrategy, SCRIPTED_LLM_STRATEGY_ID } from './llm.test.scripted';

function requestOf(capability: string, prompt = 'p'): LlmRequest {
  return { capability, prompt };
}

describe('makeScriptedLlmStrategy()', () => {
  it('should answer ordered replies and repeat the last once spent', async () => {
    const strategy = makeScriptedLlmStrategy({ replies: ['one', 'two'] });
    const texts = [];

    for (let i = 0; i < 4; i += 1) {
      texts.push((await strategy.complete(requestOf('summarize'))).text);
    }

    expect(texts).toEqual(['one', 'two', 'two', 'two']);
  });

  it('should keep a per-capability counter that never consumes the ordered replies', async () => {
    const strategy = makeScriptedLlmStrategy({ byCapability: { classify: ['c1', 'c2'], extract: 'x' }, replies: ['r1', 'r2'] });

    expect((await strategy.complete(requestOf('summarize'))).text).toBe('r1');
    expect((await strategy.complete(requestOf('classify'))).text).toBe('c1');
    expect((await strategy.complete(requestOf('extract'))).text).toBe('x');
    expect((await strategy.complete(requestOf('classify'))).text).toBe('c2');
    expect((await strategy.complete(requestOf('classify'))).text).toBe('c2');
    expect((await strategy.complete(requestOf('summarize'))).text).toBe('r2');
  });

  it('should let respond win and fall through on undefined', async () => {
    const calls: number[] = [];
    const strategy = makeScriptedLlmStrategy({
      respond: (request, call) => {
        calls.push(call);
        return request.prompt === 'special' ? 'from respond' : undefined;
      },
      byCapability: { classify: 'from capability' },
      replies: ['from replies']
    });

    expect((await strategy.complete(requestOf('classify', 'special'))).text).toBe('from respond');
    expect((await strategy.complete(requestOf('classify'))).text).toBe('from capability');
    expect((await strategy.complete(requestOf('summarize'))).text).toBe('from replies');
    expect(calls).toEqual([0, 1, 2]);
  });

  it('should let a completion spec override the defaults', async () => {
    const usage = { promptTokens: 3, completionTokens: 2, totalTokens: 5, cost: 0 };
    const strategy = makeScriptedLlmStrategy({ replies: [{ text: 'done', strategyId: 'other', finishReason: 'length', usage }] });
    const result = await strategy.complete(requestOf('summarize'));

    expect(result).toEqual({ strategyId: 'other', strategyKind: SCRIPTED_LLM_STRATEGY_ID, capability: 'summarize', text: 'done', finishReason: 'length', usage });
  });

  it('should throw an Error reply and still sink its request', async () => {
    const requests: LlmRequest[] = [];
    const failure = new Error('503 upstream');
    const strategy = makeScriptedLlmStrategy({ replies: [failure, 'recovered'], requests });

    await expect(strategy.complete(requestOf('summarize', 'first'))).rejects.toBe(failure);
    expect((await strategy.complete(requestOf('summarize', 'second'))).text).toBe('recovered');
    expect(requests.map((request) => request.prompt)).toEqual(['first', 'second']);
  });

  it('should throw naming the id, capability and call when nothing answers, treating an empty list as no reply', async () => {
    const strategy = makeScriptedLlmStrategy({ id: 'fake', byCapability: { classify: [] } });

    await expect(strategy.complete(requestOf('summarize'))).rejects.toThrow("scripted strategy 'fake' has no reply for capability 'summarize' (call 0)");
    await expect(strategy.complete(requestOf('classify'))).rejects.toThrow("scripted strategy 'fake' has no reply for capability 'classify' (call 1)");
  });

  it('should echo the request model and meta', async () => {
    const strategy = makeScriptedLlmStrategy({ replies: ['ok'] });
    const result = await strategy.complete({ ...requestOf('summarize'), model: 'vendor/model-pinned', meta: { entityId: 'e1' } });

    expect(result.model).toBe('vendor/model-pinned');
    expect(result.meta).toEqual({ entityId: 'e1' });
    expect(result.strategyId).toBe(SCRIPTED_LLM_STRATEGY_ID);
    expect(result.usage).toBeUndefined();
  });

  it('should declare its kind and no caching', () => {
    const strategy = makeScriptedLlmStrategy({ id: 'alpha', replies: [] });

    expect(strategy.id).toBe('alpha');
    expect(strategy.kind).toBe(SCRIPTED_LLM_STRATEGY_ID);
    expect(strategy.caching).toBe('none');
    expect(strategy.describe).toContain('bills nothing');
  });
});
