import { describe, expect, it } from 'vitest';
import { type LlmCompletion, type LlmRequest, type LlmStrategy } from '@dereekb/llm';
import { decorateLlmLiveStrategyAuthFailures, toLlmLiveStrategyBinding } from './llm.test.live';

const PROVIDER_ID = 'alpha';
const BASE_URL = 'https://fake.example/v1';
const MODEL = 'vendor/model-flash';
const API_KEY = 'sk-fake-revoked';
const REQUEST: LlmRequest = { prompt: 'hello', capability: 'extract' };

/**
 * A fake strategy whose `complete` throws the given value (or answers, when none is given).
 *
 * @param thrown - The value `complete` throws; omitted ⇒ it resolves a canned completion.
 * @returns The fake strategy.
 */
function makeFakeStrategy(thrown?: unknown): LlmStrategy {
  const result: LlmCompletion = { text: 'ok', strategyId: PROVIDER_ID, capability: 'extract' };
  return {
    id: PROVIDER_ID,
    describe: 'fake',
    caching: 'none',
    complete: () => (thrown === undefined ? Promise.resolve(result) : Promise.reject(thrown))
  };
}

function decorate(strategy: LlmStrategy): LlmStrategy {
  return decorateLlmLiveStrategyAuthFailures({ strategy, providerId: PROVIDER_ID, apiKeyEnv: 'ALPHA_API_KEY', baseUrl: BASE_URL, model: MODEL, selectEnv: 'LLM_PROVIDER' });
}

async function thrownBy(strategy: LlmStrategy): Promise<Error | undefined> {
  return strategy.complete(REQUEST).then(
    () => undefined,
    (error: unknown) => error as Error
  );
}

describe('decorateLlmLiveStrategyAuthFailures()', () => {
  it('should rewrite an auth rejection into the operator’s next step, keeping the original as `cause`', async () => {
    const original = Object.assign(new Error('401 User not found.'), { status: 401 });
    const thrown = await thrownBy(decorate(makeFakeStrategy(original)));

    expect(thrown?.message).toContain('ALPHA_API_KEY');
    expect(thrown?.message).toContain(PROVIDER_ID);
    expect(thrown?.message).toContain(BASE_URL);
    expect(thrown?.message).toContain(MODEL);
    expect(thrown?.message).toContain('User not found.');
    expect(thrown?.message).toContain('repoint LLM_PROVIDER / ALPHA_API_KEY');
    expect(thrown?.message.startsWith('llm live spec:')).toBe(true);
    expect(thrown?.cause).toBe(original);
    // The key itself never appears — only the NAME of the variable holding it.
    expect(thrown?.message).not.toContain(API_KEY);
  });

  it('should decorate a message-only auth rejection, but not a bare 401 with no auth phrase', async () => {
    const decorated = await thrownBy(decorate(makeFakeStrategy(new Error('HTTP 401: User not found'))));
    const bare = new Error('HTTP 401');

    expect(decorated?.message).toContain('REJECTED the credential from ALPHA_API_KEY');
    await expect(decorate(makeFakeStrategy(bare)).complete(REQUEST)).rejects.toBe(bare);
  });

  it('should rethrow anything that is NOT an auth rejection by identity', async () => {
    const serverError = Object.assign(new Error('500 upstream exploded'), { status: 500 });
    const typeError = new TypeError('fetch failed');

    await expect(decorate(makeFakeStrategy(serverError)).complete(REQUEST)).rejects.toBe(serverError);
    await expect(decorate(makeFakeStrategy(typeError)).complete(REQUEST)).rejects.toBe(typeError);
  });

  it('should pass a successful call straight through', async () => {
    await expect(decorate(makeFakeStrategy()).complete(REQUEST)).resolves.toMatchObject({ text: 'ok' });
  });

  it('should preserve `id`, so toLlmLiveStrategyBinding still routes at the decorated strategy', () => {
    const decorated = decorate(makeFakeStrategy());
    const binding = toLlmLiveStrategyBinding(decorated);

    expect(binding.defaultStrategyId).toBe(PROVIDER_ID);
    expect(binding.strategies.get(PROVIDER_ID)).toBe(decorated);
  });
});
