import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeLlmSystemOneWireFake, type LlmSystemOneWireFakeAnswer } from '@dereekb/llm/test';
import { llmTransportBackoffMs } from '../dispatch/llm.dispatch.control';
import { isLlmAbortError } from '../strategy/llm.error';
import { LlmDecisionAnswerFaultError } from './llm.decision.answer';
import { llmChoiceQuestion, llmNoulQuestion, llmScoreQuestion } from './llm.decision.question';
import { DEFAULT_LLM_DECISION_TIMEOUT_MS, isRetryableLlmDecisionError, LlmDecisionTransportError, type LlmDecisionRequest } from './llm.decision.strategy';
import { LLM_SYSTEM_ONE_DECISION_PATH, makeLlmSystemOneDecisionStrategy, type LlmSystemOneDecisionStrategyConfig, type LlmSystemOneDecisionStrategyHooks } from './llm.decision.systemone';

/**
 * The shared System One transport over a test gateway's hooks and the one `/systemone` wire fake. Every behaviour both
 * gateways share is pinned here; each gateway's spec keeps only its own facts.
 */

const MODEL = 'typesafe/jev-1.14';
const BASE_URL = 'https://gateway.test/api/v1';
const ROUTE_URL = `${BASE_URL}/systemone`;

const QUESTIONS = {
  is_urgent: llmNoulQuestion('Does this convey urgency?'),
  department: llmChoiceQuestion('Which team should handle this?', { billing: 'Payments, invoicing, refunds', technical: null }),
  frustration: llmScoreQuestion('How frustrated is the customer?', ['Calm', 'Frustrated', 'Very angry'])
};

const REQUEST = { state: 'Help! My payouts have been failing for 3 days.', questions: QUESTIONS, model: MODEL };

const TYPED_ANSWERS = {
  is_urgent: { type: 'noul', noul: 0.94 },
  department: { type: 'choice', choice: 'billing', probabilities: { billing: 0.9, technical: 0.1 } },
  frustration: { type: 'score', score: 1.4 }
};

const HOOKS: LlmSystemOneDecisionStrategyHooks = {
  kind: 'test-systemone',
  label: 'Gateway',
  defaultBaseUrl: BASE_URL,
  credentialProbe: vi.fn(async () => ({ ready: true, issues: [] }))
};

const HEADER_HOOKS: LlmSystemOneDecisionStrategyHooks = { ...HOOKS, generationIdHeader: 'x-gateway-id' };
const BASIS_HOOKS: LlmSystemOneDecisionStrategyHooks = { ...HOOKS, costBasis: 'list' };
const LAX_HOOKS: LlmSystemOneDecisionStrategyHooks = { ...HOOKS, laxAnswerTypes: true };

function strategyAnswering(answer: LlmSystemOneWireFakeAnswer, hooks: LlmSystemOneDecisionStrategyHooks = HOOKS, config: LlmSystemOneDecisionStrategyConfig = {}) {
  const fake = makeLlmSystemOneWireFake({ respond: answer });
  return { fake, strategy: makeLlmSystemOneDecisionStrategy({ apiKey: 'sk-test', decisionFetch: fake.fetch, ...config }, hooks) };
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('makeLlmSystemOneDecisionStrategy()', () => {
  describe('wire', () => {
    it('POSTs to `{defaultBaseUrl}/systemone`, and a configured base URL with a trailing slash maps to the same URL', async () => {
      const defaulted = strategyAnswering({});
      const slashed = strategyAnswering({}, HOOKS, { baseUrl: `${BASE_URL}/` });
      await defaulted.strategy.decide(REQUEST);
      await slashed.strategy.decide(REQUEST);

      expect(LLM_SYSTEM_ONE_DECISION_PATH).toBe('/systemone');
      expect(defaulted.fake.requests.map((request) => `${request.init.method} ${request.url}`)).toEqual([`POST ${ROUTE_URL}`]);
      expect(slashed.fake.requests[0]?.url).toBe(ROUTE_URL);
    });

    it('sends exactly the Authorization, Content-Type and Accept headers', async () => {
      const { fake, strategy } = strategyAnswering({});
      await strategy.decide(REQUEST);

      expect(fake.requests[0]?.init.headers).toEqual({ Authorization: 'Bearer sk-test', 'Content-Type': 'application/json', Accept: 'application/json' });
    });

    it('sends the body keys in the order model, state, questions — compared as the raw string', async () => {
      const { fake, strategy } = strategyAnswering({});
      await strategy.decide({ state: 'x', questions: { is_urgent: QUESTIONS.is_urgent }, model: MODEL });

      expect(fake.requests[0]?.init.body).toBe(`{"model":"${MODEL}","state":"x","questions":{"is_urgent":{"type":"noul","instructions":"Does this convey urgency?"}}}`);
    });

    it('never leaks a host-extended request field onto the wire', async () => {
      const { fake, strategy } = strategyAnswering({});
      await strategy.decide({ ...REQUEST, sessionId: 's', meta: { run: 'r1' } } as LlmDecisionRequest<typeof QUESTIONS>);

      expect(Object.keys(fake.requests[0]?.body ?? {})).toEqual(['model', 'state', 'questions']);
    });

    it('collapses the three primitives onto `criteria`, keeps structured entries as equal JSON and omits a means-less Noul’s criteria', async () => {
      const structured = {
        team: llmChoiceQuestion({ question: 'Which team?' }, { billing: { what: 'Charges', examples: ['charged twice'] }, orders: null }),
        heat: llmScoreQuestion('how urgent?', ['idle', 'soon', 'now']),
        fits: llmNoulQuestion('does it fit?', { true: 'it fits', false: 'it does not' }),
        bare: llmNoulQuestion('is it so?')
      };
      const { fake, strategy } = strategyAnswering({});
      await strategy.decide({ state: 'x', questions: structured, model: MODEL });

      expect(fake.requests[0]?.body?.questions).toEqual({
        team: { type: 'choice', instructions: { question: 'Which team?' }, criteria: { billing: { what: 'Charges', examples: ['charged twice'] }, orders: null } },
        heat: { type: 'score', instructions: 'how urgent?', criteria: ['idle', 'soon', 'now'] },
        fits: { type: 'noul', instructions: 'does it fit?', criteria: { true: 'it fits', false: 'it does not' } },
        bare: { type: 'noul', instructions: 'is it so?' }
      });
    });
  });

  describe('read', () => {
    it('reads a typed reply: answers, the answering model, the generation id and the provider, in that key order', async () => {
      const { strategy } = strategyAnswering({ body: { id: 'gen-1', model: 'typesafe/jev-1.14-20260901', provider: 'TypeSafe', answers: TYPED_ANSWERS, usage: { input_tokens: 10, output_tokens: 2 } } });
      const result = await strategy.decide(REQUEST);

      expect(result.answers.is_urgent.noul).toBe(0.94);
      expect(result.answers.department.choice).toBe('billing');
      expect(result.answers.frustration.score).toBe(1.4);
      expect(result.model).toBe('typesafe/jev-1.14-20260901');
      expect(result.generationId).toBe('gen-1');
      expect(result.provider).toBe('TypeSafe');
      expect(Object.keys(result)).toEqual(['model', 'answers', 'usage', 'generationId', 'provider']);
    });

    it('keeps the maximal and minimal result key order and bytes (pin)', async () => {
      const full = await strategyAnswering({ body: { id: 'gen-1', model: 'typesafe/jev-1.14-20260901', provider: 'TypeSafe', answers: TYPED_ANSWERS, usage: { input_tokens: 10, output_tokens: 2 } } }).strategy.decide(REQUEST);
      const bare = await strategyAnswering({ body: { id: null, model: null, provider: null, answers: TYPED_ANSWERS, usage: null } }).strategy.decide(REQUEST);

      expect(JSON.stringify(full)).toBe(
        '{"model":"typesafe/jev-1.14-20260901","answers":{"is_urgent":{"type":"noul","noul":0.94},"department":{"type":"choice","choice":"billing","probabilities":{"billing":0.9,"technical":0.1}},"frustration":{"type":"score","score":1.4}},"usage":{"promptTokens":10,"completionTokens":2,"totalTokens":12},"generationId":"gen-1","provider":"TypeSafe"}'
      );
      expect(Object.keys(bare)).toEqual(['model', 'answers']);
      expect(JSON.stringify(bare)).toBe('{"model":"typesafe/jev-1.14","answers":{"is_urgent":{"type":"noul","noul":0.94},"department":{"type":"choice","choice":"billing","probabilities":{"billing":0.9,"technical":0.1}},"frustration":{"type":"score","score":1.4}}}');
    });

    it('keeps the requested slug when no model is echoed, and ignores blank or non-string id / model / provider', async () => {
      const bare = await strategyAnswering({ body: { answers: TYPED_ANSWERS } }).strategy.decide(REQUEST);
      const blank = await strategyAnswering({ body: { id: ' ', model: '', provider: 7, answers: TYPED_ANSWERS } }).strategy.decide(REQUEST);

      expect(bare.model).toBe(MODEL);
      expect(blank).toEqual({ model: MODEL, answers: TYPED_ANSWERS });
    });

    it('reads the generation id off the hooks’ header only, preferring a body id and reading a blank header as no id', async () => {
      const header = { 'X-Gateway-Id': 'gen-header' };
      const noHook = await strategyAnswering({ body: { answers: TYPED_ANSWERS }, headers: header }).strategy.decide(REQUEST);
      const fromHeader = await strategyAnswering({ body: { answers: TYPED_ANSWERS }, headers: header }, HEADER_HOOKS).strategy.decide(REQUEST);
      const bodyWins = await strategyAnswering({ body: { id: 'gen-body', answers: TYPED_ANSWERS }, headers: header }, HEADER_HOOKS).strategy.decide(REQUEST);
      const blankHeader = await strategyAnswering({ body: { answers: TYPED_ANSWERS }, headers: { 'x-gateway-id': '' } }, HEADER_HOOKS).strategy.decide(REQUEST);

      expect(noHook.generationId).toBeUndefined();
      expect(fromHeader.generationId).toBe('gen-header');
      expect(bodyWins.generationId).toBe('gen-body');
      expect(blankHeader.generationId).toBeUndefined();
    });
  });

  describe('answer types', () => {
    const TYPELESS = { is_urgent: { noul: 0.2 }, department: { choice: 'technical' }, frustration: { score: 0.5 } };

    it('types type-less answers under lax hooks', async () => {
      const result = await strategyAnswering({ body: { answers: TYPELESS } }, LAX_HOOKS).strategy.decide(REQUEST);

      expect(result.answers).toEqual({ is_urgent: { type: 'noul', noul: 0.2 }, department: { type: 'choice', choice: 'technical' }, frustration: { type: 'score', score: 0.5 } });
    });

    it('faults a type-less answer as answer-mistyped under strict hooks', async () => {
      const thrown = await thrownBy(strategyAnswering({ body: { answers: TYPELESS } }).strategy.decide(REQUEST));

      expect(thrown).toBeInstanceOf(LlmDecisionAnswerFaultError);
      expect((thrown as LlmDecisionAnswerFaultError).faults.map((fault) => fault.kind)).toEqual(['answer-mistyped', 'answer-mistyped', 'answer-mistyped']);
    });

    it('throws on a mistyped, an off-option and a missing answer, and reads a non-object `answers` as none', async () => {
      const mistyped = await thrownBy(strategyAnswering({ body: { answers: { ...TYPED_ANSWERS, is_urgent: { type: 'choice', choice: 'billing' } } } }, LAX_HOOKS).strategy.decide(REQUEST));
      const offOption = await thrownBy(strategyAnswering({ body: { answers: { ...TYPED_ANSWERS, department: { type: 'choice', choice: 'legal' } } } }).strategy.decide(REQUEST));
      const missing = await thrownBy(strategyAnswering({ body: { answers: { is_urgent: TYPED_ANSWERS.is_urgent } } }).strategy.decide(REQUEST));
      const nonObject = await thrownBy(strategyAnswering({ body: { answers: 'none' } }).strategy.decide(REQUEST));

      expect(mistyped).toBeInstanceOf(LlmDecisionAnswerFaultError);
      expect(offOption).toBeInstanceOf(LlmDecisionAnswerFaultError);
      expect(missing).toBeInstanceOf(LlmDecisionAnswerFaultError);
      expect((nonObject as LlmDecisionAnswerFaultError).faults.map((fault) => fault.kind)).toEqual(['answer-missing', 'answer-missing', 'answer-missing']);
    });
  });

  describe('usage', () => {
    it('folds snake_case usage, stamping the hooks’ basis only beside a cost', async () => {
      const withCost = await strategyAnswering({ body: { answers: TYPED_ANSWERS, usage: { input_tokens: 350, output_tokens: 34, cost: 0.0000147 } } }, BASIS_HOOKS).strategy.decide(REQUEST);
      const noCost = await strategyAnswering({ body: { answers: TYPED_ANSWERS, usage: { input_tokens: 120 } } }, BASIS_HOOKS).strategy.decide(REQUEST);
      const unstamped = await strategyAnswering({ body: { answers: TYPED_ANSWERS, usage: { input_tokens: 272, output_tokens: 20, cost: 0.000011424 } } }).strategy.decide(REQUEST);

      expect(withCost.usage).toEqual({ promptTokens: 350, completionTokens: 34, totalTokens: 384, cost: 0.0000147, costBasis: 'list' });
      expect(noCost.usage).toEqual({ promptTokens: 120, completionTokens: 0, totalTokens: 120 });
      expect(unstamped.usage).toEqual({ promptTokens: 272, completionTokens: 20, totalTokens: 292, cost: 0.000011424 });
    });

    it('omits usage the reply did not send, and reads a non-object usage as absent', async () => {
      const none = await strategyAnswering({ body: { answers: TYPED_ANSWERS } }).strategy.decide(REQUEST);
      const nonObject = await strategyAnswering({ body: { answers: TYPED_ANSWERS, usage: 42 } }).strategy.decide(REQUEST);

      expect(none.usage).toBeUndefined();
      expect(nonObject.usage).toBeUndefined();
      expect('usage' in nonObject).toBe(false);
    });
  });

  describe('failures', () => {
    it('classifies 429 / 500 as retryable and 400 / 404 as not, carrying the provider’s words, the route and the raw body', async () => {
      const limited = await thrownBy(strategyAnswering({ status: 429, body: { error: { message: 'Rate limit exceeded' } } }).strategy.decide(REQUEST));
      const overloaded = await thrownBy(strategyAnswering({ status: 500, body: 'upstream overloaded' }).strategy.decide(REQUEST));
      const refused = await thrownBy(strategyAnswering({ status: 400, body: { error: { message: 'not a System One model' } } }).strategy.decide(REQUEST));
      const notFound = await thrownBy(strategyAnswering({ status: 404, body: { error: { message: 'Not Found' } } }).strategy.decide(REQUEST));

      expect(limited).toBeInstanceOf(LlmDecisionTransportError);
      expect((limited as LlmDecisionTransportError).status).toBe(429);
      expect((limited as LlmDecisionTransportError).message).toBe(`the Gateway System One route ${ROUTE_URL} answered HTTP 429: Rate limit exceeded`);
      expect((limited as LlmDecisionTransportError).body).toBe('{"error":{"message":"Rate limit exceeded"}}');
      expect(isRetryableLlmDecisionError(limited)).toBe(true);
      expect(isRetryableLlmDecisionError(overloaded)).toBe(true);
      expect((overloaded as LlmDecisionTransportError).body).toBe('upstream overloaded');
      expect(isRetryableLlmDecisionError(refused)).toBe(false);
      expect(isRetryableLlmDecisionError(notFound)).toBe(false);
      expect((notFound as LlmDecisionTransportError).message).toContain('Not Found');
    });

    it('carries the response headers on a non-2xx answer, so a Retry-After reaches the dispatcher backoff', async () => {
      const limited = await thrownBy(strategyAnswering({ status: 429, body: { error: { message: 'Rate limit exceeded' } }, headers: { 'retry-after': '1' } }).strategy.decide(REQUEST));

      expect(limited).toBeInstanceOf(LlmDecisionTransportError);
      expect((limited as LlmDecisionTransportError).headers?.get('retry-after')).toBe('1');
      expect(llmTransportBackoffMs({ attempt: 1, error: limited }, () => 1)).toBe(1000);
    });

    it('reports a non-JSON 200, a JSON null and a JSON array as transport errors carrying the body', async () => {
      for (const body of ['<html>gateway</html>', 'null', '[1]']) {
        const thrown = await thrownBy(strategyAnswering({ body }).strategy.decide(REQUEST));

        expect(thrown).toBeInstanceOf(LlmDecisionTransportError);
        expect((thrown as LlmDecisionTransportError).status).toBe(200);
        expect((thrown as LlmDecisionTransportError).body).toBe(body);
        expect((thrown as LlmDecisionTransportError).message).toBe(`the Gateway System One route ${ROUTE_URL} answered HTTP 200 with a body that is not a JSON object`);
      }
    });

    it('wraps a socket failure with its cause, naming the route, and it still reads retryable', async () => {
      const cause = new TypeError('fetch failed');
      const fake = makeLlmSystemOneWireFake({
        respond: () => {
          throw cause;
        }
      });
      const thrown = await thrownBy(makeLlmSystemOneDecisionStrategy({ apiKey: 'sk-test', decisionFetch: fake.fetch }, HOOKS).decide(REQUEST));

      expect(thrown).toBeInstanceOf(LlmDecisionTransportError);
      expect((thrown as LlmDecisionTransportError).message).toBe(`the Gateway System One route ${ROUTE_URL} could not be reached: fetch failed`);
      expect((thrown as LlmDecisionTransportError).cause).toBe(cause);
      expect((thrown as LlmDecisionTransportError).status).toBeUndefined();
      expect(isRetryableLlmDecisionError(thrown)).toBe(true);
    });

    it('maps a failing body read exactly like a failed fetch', async () => {
      const cause = new TypeError('terminated');
      const strategy = makeLlmSystemOneDecisionStrategy(
        {
          apiKey: 'sk-test',
          // A real 200 Response whose body read fails mid-stream.
          decisionFetch: async () =>
            Object.assign(new Response(''), {
              text: async () => {
                throw cause;
              }
            })
        },
        HOOKS
      );
      const thrown = await thrownBy(strategy.decide(REQUEST));

      expect(thrown).toBeInstanceOf(LlmDecisionTransportError);
      expect((thrown as LlmDecisionTransportError).cause).toBe(cause);
    });
  });

  describe('abort and timeout', () => {
    function hanging(config: LlmSystemOneDecisionStrategyConfig = {}) {
      return makeLlmSystemOneDecisionStrategy({ apiKey: 'sk-test', decisionFetch: makeLlmSystemOneWireFake({ respond: 'hang' }).fetch, ...config }, HOOKS);
    }

    it("rejects a caller abort with the caller's reason, never a transport error", async () => {
      const controller = new AbortController();
      const pending = thrownBy(hanging().decide(REQUEST, { signal: controller.signal }));
      controller.abort();
      const thrown = await pending;

      expect(thrown).not.toBeInstanceOf(LlmDecisionTransportError);
      expect((thrown as Error).name).toBe('AbortError');
      expect(isLlmAbortError(thrown)).toBe(true);
    });

    it('surfaces a custom abort reason as itself', async () => {
      const reason = new Error('the caller moved on');
      const controller = new AbortController();
      const pending = thrownBy(hanging().decide(REQUEST, { signal: controller.signal }));
      controller.abort(reason);

      expect(await pending).toBe(reason);
    });

    it('times out with a TimeoutError, with or without a caller signal, and never retries it', async () => {
      const alone = await thrownBy(hanging().decide(REQUEST, { timeoutMs: 5 }));
      const withSignal = await thrownBy(hanging({ timeoutMs: 5 }).decide(REQUEST, { signal: new AbortController().signal }));

      for (const thrown of [alone, withSignal]) {
        expect((thrown as Error).name).toBe('TimeoutError');
        expect(isLlmAbortError(thrown)).toBe(true);
        expect(isRetryableLlmDecisionError(thrown)).toBe(false);
      }
    });

    it('takes the timeout from the call options, else the config, else the default', async () => {
      const timeout = vi.spyOn(AbortSignal, 'timeout');
      await strategyAnswering({}).strategy.decide(REQUEST);
      await strategyAnswering({}, HOOKS, { timeoutMs: 4_000 }).strategy.decide(REQUEST);
      await strategyAnswering({}, HOOKS, { timeoutMs: 4_000 }).strategy.decide(REQUEST, { timeoutMs: 1_500 });

      expect(timeout.mock.calls.map((call) => call[0])).toEqual([DEFAULT_LLM_DECISION_TIMEOUT_MS, 4_000, 1_500]);
    });
  });

  describe('readiness', () => {
    it('refuses a key-less decide with the exact, non-retryable message, with and without the env var label', async () => {
      const labelled = await thrownBy(makeLlmSystemOneDecisionStrategy({ apiKeyEnv: 'HOST_GATEWAY_API_KEY' }, HOOKS).decide(REQUEST));
      const bare = await thrownBy(makeLlmSystemOneDecisionStrategy({ id: 'account-a' }, HOOKS).decide(REQUEST));

      expect((labelled as LlmDecisionTransportError).message).toBe("Gateway decision strategy 'test-systemone': no apiKey configured and no decisionFetch injected (set HOST_GATEWAY_API_KEY, or gate startup via the readiness check).");
      expect((bare as LlmDecisionTransportError).message).toBe("Gateway decision strategy 'account-a': no apiKey configured and no decisionFetch injected (pass an apiKey, or gate startup via the readiness check).");
      expect((bare as LlmDecisionTransportError).status).toBeUndefined();
      expect(isRetryableLlmDecisionError(bare)).toBe(false);
    });

    it('healthCheck names the remedy when key-less, and is ready — sending nothing — with a key or an injected fetch', async () => {
      const fake = makeLlmSystemOneWireFake();
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      expect(await makeLlmSystemOneDecisionStrategy({ id: 'gw', apiKeyEnv: 'HOST_GATEWAY_API_KEY' }, HOOKS).healthCheck?.()).toEqual({ ready: false, issues: [{ severity: 'error', message: "no decisions API key is configured for 'gw': set HOST_GATEWAY_API_KEY" }] });
      expect(await makeLlmSystemOneDecisionStrategy({ id: 'gw' }, HOOKS).healthCheck?.()).toEqual({ ready: false, issues: [{ severity: 'error', message: "no decisions API key is configured for 'gw': pass an apiKey" }] });
      expect(await makeLlmSystemOneDecisionStrategy({ apiKey: 'sk-test' }, HOOKS).healthCheck?.()).toEqual({ ready: true, issues: [] });
      expect(await makeLlmSystemOneDecisionStrategy({ decisionFetch: fake.fetch }, HOOKS).healthCheck?.()).toEqual({ ready: true, issues: [] });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(fake.requests).toEqual([]);
    });

    it('credentialProbe is ready for an injected fake with no probeFetch, sending nothing', async () => {
      const credentialProbe = vi.fn(async () => ({ ready: false, issues: [] }));
      const fake = makeLlmSystemOneWireFake();

      expect(await makeLlmSystemOneDecisionStrategy({ decisionFetch: fake.fetch }, { ...HOOKS, credentialProbe }).credentialProbe?.()).toEqual({ ready: true, issues: [] });
      expect(credentialProbe).not.toHaveBeenCalled();
      expect(fake.requests).toEqual([]);
    });

    it('credentialProbe delegates to the hooks with the id, trimmed base URL, key, seam and signal', async () => {
      const credentialProbe = vi.fn(async () => ({ ready: true, issues: [] }));
      const probeFetch = vi.fn();
      const signal = new AbortController().signal;
      const strategy = makeLlmSystemOneDecisionStrategy({ id: 'gw', apiKey: 'sk-test', baseUrl: `${BASE_URL}//`, probeFetch }, { ...HOOKS, credentialProbe });

      expect(await strategy.credentialProbe?.({ signal })).toEqual({ ready: true, issues: [] });
      expect(credentialProbe).toHaveBeenCalledWith({ strategyId: 'gw', baseUrl: BASE_URL, apiKey: 'sk-test', fetch: probeFetch, signal });
    });

    it('credentialProbe reports a missing key with the exact message', async () => {
      expect(await makeLlmSystemOneDecisionStrategy({ apiKeyEnv: 'HOST_GATEWAY_API_KEY' }, HOOKS).credentialProbe?.()).toEqual({ ready: false, issues: [{ severity: 'error', message: 'no apiKey configured and no decisionFetch injected (set HOST_GATEWAY_API_KEY)' }] });
    });
  });

  describe('identity', () => {
    it('defaults the id to the hooks’ kind, reports that kind and describes itself by its route', () => {
      const bare = makeLlmSystemOneDecisionStrategy({ apiKey: 'sk-test' }, HOOKS);
      const named = makeLlmSystemOneDecisionStrategy({ id: 'gw-payg', apiKey: 'sk-test' }, HOOKS);

      expect(bare.id).toBe('test-systemone');
      expect(named.id).toBe('gw-payg');
      expect(named.kind).toBe('test-systemone');
      expect(bare.describe).toBe('Gateway System One at https://gateway.test/api/v1/systemone');
    });
  });

  describe('global fetch', () => {
    it('reads the global fetch at call time, so a stub made after construction is the one used', async () => {
      const strategy = makeLlmSystemOneDecisionStrategy({ apiKey: 'sk-test' }, HOOKS);
      const fake = makeLlmSystemOneWireFake();
      vi.stubGlobal('fetch', fake.fetch);
      const result = await strategy.decide(REQUEST);

      expect(fake.requests.map((request) => request.url)).toEqual([ROUTE_URL]);
      expect(result.answers.department.choice).toBe('billing');
    });
  });
});
