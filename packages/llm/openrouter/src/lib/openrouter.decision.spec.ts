import { describe, expect, it } from 'vitest';
import { isLlmAbortError, isRetryableLlmDecisionError, LlmDecisionAnswerFaultError, LlmDecisionTransportError, llmChoiceQuestion, llmNoulQuestion, llmScoreQuestion } from '@dereekb/llm';
import { makeLlmSystemOneWireFake, type LlmSystemOneWireFakeConfig } from '@dereekb/llm/test';
import { LLM_OPENROUTER_DECISION_STRATEGY_KIND, makeLlmOpenRouterDecisionStrategy } from './openrouter.decision';

/**
 * The OpenRouter decision strategy — OpenRouter's hooks over the core System One transport, run over the one
 * `/systemone` wire fake. Only OpenRouter's own facts are pinned here (its route, its strict answer types, its exact
 * unstamped cost, its `/key` probe); every shared behaviour is pinned once in the core transport's spec.
 */

const DECISION_MODEL = 'typesafe/jev-1.14';

const QUESTIONS = {
  row: llmChoiceQuestion('which row does the phrase name?', { 'row-a': 'the first row', 'row-b': null }),
  heat: llmScoreQuestion('how urgent?', ['idle', 'soon', 'now']),
  any: llmNoulQuestion('at least one row means what the phrase describes.', { true: 'one of them fits', false: 'none of them fit' })
};

const REQUEST = { state: { phrase: 'on the pile' }, questions: { any: QUESTIONS.any }, model: DECISION_MODEL };

/**
 * The RECORDED wire reply of a billed OpenRouter decision call.
 */
const WIRE_REPLY = { id: 'gen-dec-1', model: 'typesafe/jev-1.14-20260917', provider: 'TypeSafe', answers: { any: { type: 'noul', noul: 0.67 } }, usage: { input_tokens: 272, output_tokens: 20, cost: 0.000011424 } };

function strategyOver(respond: LlmSystemOneWireFakeConfig['respond'], baseUrl?: string) {
  const fake = makeLlmSystemOneWireFake({ respond });
  return { fake, strategy: makeLlmOpenRouterDecisionStrategy({ apiKey: 'sk-test', decisionFetch: fake.fetch, ...(baseUrl == null ? {} : { baseUrl }) }) };
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error
  );
}

describe('makeLlmOpenRouterDecisionStrategy()', () => {
  it('POSTs to `https://openrouter.ai/api/v1/systemone` with the bearer key, and a configured `baseUrl` governs it', async () => {
    const cases = [
      { baseUrl: undefined, url: 'https://openrouter.ai/api/v1/systemone' },
      { baseUrl: 'https://openrouter.ai/api/v1/', url: 'https://openrouter.ai/api/v1/systemone' },
      { baseUrl: 'https://gateway.test/api/v1', url: 'https://gateway.test/api/v1/systemone' }
    ];

    for (const { baseUrl, url } of cases) {
      const { fake, strategy } = strategyOver({ body: WIRE_REPLY }, baseUrl);
      await strategy.decide(REQUEST);

      expect(fake.requests.map((request) => `${request.init.method} ${request.url}`)).toEqual([`POST ${url}`]);
      expect(fake.requests[0]?.init.headers['Authorization']).toBe('Bearer sk-test');
      expect(fake.requests[0]?.body).toEqual({ model: DECISION_MODEL, state: { phrase: 'on the pile' }, questions: { any: { type: 'noul', instructions: QUESTIONS.any.instructions, criteria: { true: 'one of them fits', false: 'none of them fit' } } } });
    }
  });

  it('reads the RECORDED wire reply: the exact, unstamped synchronous cost, the body id and the provider', async () => {
    const result = await strategyOver({ body: WIRE_REPLY }).strategy.decide(REQUEST);

    expect(result.answers.any.noul).toBe(0.67);
    expect(result.model).toBe('typesafe/jev-1.14-20260917');
    expect(result.usage).toEqual({ promptTokens: 272, completionTokens: 20, totalTokens: 292, cost: 0.000011424 });
    expect(result.generationId).toBe('gen-dec-1');
    expect(result.provider).toBe('TypeSafe');
  });

  it('reads answer types strictly: a type-less answer faults', async () => {
    const thrown = await thrownBy(strategyOver({ body: { answers: { any: { noul: 0.67 } } } }).strategy.decide(REQUEST));

    expect(thrown).toBeInstanceOf(LlmDecisionAnswerFaultError);
    expect((thrown as LlmDecisionAnswerFaultError).faults[0]?.kind).toBe('answer-mistyped');
  });

  it('surfaces a 404 as a non-retryable transport error carrying the status, never as an answer', async () => {
    const thrown = await thrownBy(strategyOver({ status: 404, body: { error: { message: 'Not Found', code: 404 } } }).strategy.decide(REQUEST));

    expect(thrown).toBeInstanceOf(LlmDecisionTransportError);
    expect((thrown as LlmDecisionTransportError).status).toBe(404);
    expect((thrown as LlmDecisionTransportError).message).toContain('Not Found');
    expect(isRetryableLlmDecisionError(thrown)).toBe(false);
  });

  it('surfaces a 429 as a retryable transport error', async () => {
    const thrown = await thrownBy(strategyOver({ status: 429, body: { error: { message: 'Rate limited', code: 429 } } }).strategy.decide(REQUEST));

    expect((thrown as LlmDecisionTransportError).status).toBe(429);
    expect(isRetryableLlmDecisionError(thrown)).toBe(true);
  });

  it('holds the timeout even when the caller passes a signal, rejecting with the native TimeoutError', async () => {
    const fake = makeLlmSystemOneWireFake({ respond: 'hang' });
    const strategy = makeLlmOpenRouterDecisionStrategy({ apiKey: 'sk-test', timeoutMs: 20, decisionFetch: fake.fetch });
    const thrown = await thrownBy(strategy.decide(REQUEST, { signal: new AbortController().signal }));

    expect((thrown as Error).name).toBe('TimeoutError');
    expect(isRetryableLlmDecisionError(thrown)).toBe(false);
  });

  it("rejects a caller abort with the caller's reason, not a transport error", async () => {
    const { strategy } = strategyOver('hang');
    const controller = new AbortController();
    const pending = thrownBy(strategy.decide(REQUEST, { signal: controller.signal }));
    controller.abort();
    const thrown = await pending;

    expect(thrown).not.toBeInstanceOf(LlmDecisionTransportError);
    expect(isLlmAbortError(thrown)).toBe(true);
  });

  it('wraps a socket failure in a transport error that keeps the native cause, and still reads retryable', async () => {
    const cause = new TypeError('fetch failed');
    const thrown = await thrownBy(
      strategyOver(() => {
        throw cause;
      }).strategy.decide(REQUEST)
    );

    expect(thrown).toBeInstanceOf(LlmDecisionTransportError);
    expect((thrown as LlmDecisionTransportError).cause).toBe(cause);
    expect(isRetryableLlmDecisionError(thrown)).toBe(true);
  });

  it('declares the decisions transport kind, so a ledger row can never confuse it with the completion lane', () => {
    const named = makeLlmOpenRouterDecisionStrategy({ apiKey: 'k', id: 'account-a' });
    const bare = makeLlmOpenRouterDecisionStrategy({ apiKey: 'k' });

    expect(named.id).toBe('account-a');
    expect(named.kind).toBe(LLM_OPENROUTER_DECISION_STRATEGY_KIND);
    expect(bare.id).toBe('openrouter-decisions');
    expect(LLM_OPENROUTER_DECISION_STRATEGY_KIND).toBe('openrouter-decisions');
    expect(bare.describe).toBe('OpenRouter System One at https://openrouter.ai/api/v1/systemone');
  });

  it('reports a key-less instance as not ready, and rejects its decide with a non-retryable error naming the instance', async () => {
    const keyless = makeLlmOpenRouterDecisionStrategy({ id: 'account-a' });
    const thrown = await thrownBy(keyless.decide(REQUEST));

    expect((await keyless.healthCheck?.())?.ready).toBe(false);
    expect(thrown).toBeInstanceOf(LlmDecisionTransportError);
    expect((thrown as LlmDecisionTransportError).message).toContain("'account-a'");
    expect(isRetryableLlmDecisionError(thrown)).toBe(false);
  });

  it('probes credentials against the SAME free key endpoint the completion sibling uses', async () => {
    const urls: string[] = [];
    const strategy = makeLlmOpenRouterDecisionStrategy({
      apiKey: 'k',
      probeFetch: async (url) => {
        urls.push(url);
        return new Response('{}', { status: 200 });
      }
    });
    const health = await strategy.credentialProbe?.();

    expect(urls).toEqual(['https://openrouter.ai/api/v1/key']);
    expect(health?.ready).toBe(true);
  });
});
