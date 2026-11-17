import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_DECISION_TIMEOUT_MS, isAbortError, isRetryableLlmDecisionError, LlmDecisionAnswerFaultError, LlmDecisionTransportError, llmChoiceQuestion, llmNoulQuestion, llmScoreQuestion, type LlmDecisionRequestBody } from '@dereekb/llm';
import { LLM_OPENROUTER_DECISION_STRATEGY_KIND, llmUsageFromOpenRouterDecisionsUsage, makeLlmOpenRouterDecisionStrategy, type LlmOpenRouterDecisionsCreateOptions, type LlmOpenRouterDecisionsReply } from './openrouter.decision';

/**
 * The OpenRouter decision transport, over an INJECTED call seam — so the whole transport (the assembled body included)
 * runs with no SDK, no key and no socket. Proves: the body (`llmDecisionRequestBody`) is EXACTLY
 * `{model, state, questions}`; the three primitives collapse onto the one `criteria` wire key and nothing else leaks;
 * `usage.cost` survives the fold, which is the one thing this lane has that the completion lane structurally cannot;
 * an off-option answer THROWS rather than returning.
 *
 * The fake-socket blocks deliberately load the real SDK — over a fake socket, never a real one — because the one
 * defect the seam cannot see is the URL the SDK assembles, and the failure values the SDK produces. The route pin is
 * written against whatever SDK version is installed rather than against a remembered path.
 */

const DECISION_MODEL = 'typesafe/jev-1.14';

const QUESTIONS = {
  row: llmChoiceQuestion('which row does the phrase name?', { 'row-a': 'the first row', 'row-b': null }),
  heat: llmScoreQuestion('how urgent?', ['idle', 'soon', 'now']),
  any: llmNoulQuestion('at least one row means what the phrase describes.', { true: 'one of them fits', false: 'none of them fit' })
};

/**
 * Build the strategy over a captured fake call seam.
 *
 * @param reply - What the fake answers with.
 * @param sent - The sink the assembled body is captured into.
 * @returns The strategy, the captured bodies and the captured options.
 */
function strategyOver(reply: LlmOpenRouterDecisionsReply, sent: LlmDecisionRequestBody[] = []) {
  const options: Array<LlmOpenRouterDecisionsCreateOptions | undefined> = [];
  return {
    sent,
    options,
    strategy: makeLlmOpenRouterDecisionStrategy({
      decisionsCreate: async (body, createOptions) => {
        sent.push(body);
        options.push(createOptions);
        return reply;
      }
    })
  };
}

const SOUND_REPLY: LlmOpenRouterDecisionsReply = {
  id: 'gen-abc',
  model: 'typesafe/jev-1.14',
  provider: 'TypeSafe',
  answers: { row: { type: 'choice', choice: 'row-a', probabilities: { 'row-a': 0.9, 'row-b': 0.1 }, confidence: 0.9 }, heat: { type: 'score', score: 1.2 }, any: { type: 'noul', noul: 0.91 } },
  usage: { cost: 0.000046, inputTokens: 3800, outputTokens: 0 }
};

describe('makeLlmOpenRouterDecisionStrategy()', () => {
  it('sends EXACTLY {model, state, questions} with the requested slug', async () => {
    const { strategy, sent } = strategyOver(SOUND_REPLY);
    await strategy.decide({ state: { phrase: 'on the pile' }, questions: QUESTIONS, model: DECISION_MODEL });

    expect(Object.keys(sent[0] ?? {})).toEqual(['model', 'state', 'questions']);
    expect(sent[0]?.model).toBe(DECISION_MODEL);
    expect(sent[0]?.state).toEqual({ phrase: 'on the pile' });
  });

  it('collapses all three primitives onto the one `criteria` wire key', async () => {
    const { strategy, sent } = strategyOver(SOUND_REPLY);
    await strategy.decide({ state: 'x', questions: QUESTIONS, model: DECISION_MODEL });

    expect(sent[0]?.questions).toEqual({
      row: { type: 'choice', instructions: 'which row does the phrase name?', criteria: { 'row-a': 'the first row', 'row-b': null } },
      heat: { type: 'score', instructions: 'how urgent?', criteria: ['idle', 'soon', 'now'] },
      any: { type: 'noul', instructions: 'at least one row means what the phrase describes.', criteria: { true: 'one of them fits', false: 'none of them fit' } }
    });
  });

  it('carries STRUCTURED instructions and criteria through the one `criteria` key verbatim, for all three primitives', async () => {
    const structured = {
      team: llmChoiceQuestion({ question: 'Which team should handle `ticket`?', focus: 'the primary request' }, { billing: { what: 'Charges', not_for: 'Orders', examples: ['charged twice'] }, orders: null }),
      focus: llmScoreQuestion({ question: 'How focused is `ticket`?' }, [
        { what: 'one change', signals: ['a single fix'] },
        { what: 'several changes', signals: ['"also"'] }
      ]),
      credential: llmNoulQuestion({ question: 'Does `ticket` ask for a credential?', inspect: 'ticket' }, { true: { what: 'asks for a password' }, false: { what: 'does not' } })
    };
    const { strategy, sent } = strategyOver({ answers: { team: { type: 'choice', choice: 'billing', probabilities: { billing: 0.9, orders: 0.1 }, confidence: 0.9 }, focus: { type: 'score', score: 0.2 }, credential: { type: 'noul', noul: 0.1 } } });
    await strategy.decide({ state: { ticket: 'x' }, questions: structured, model: DECISION_MODEL });

    expect(sent[0]?.questions).toEqual({
      team: { type: 'choice', instructions: { question: 'Which team should handle `ticket`?', focus: 'the primary request' }, criteria: { billing: { what: 'Charges', not_for: 'Orders', examples: ['charged twice'] }, orders: null } },
      focus: {
        type: 'score',
        instructions: { question: 'How focused is `ticket`?' },
        criteria: [
          { what: 'one change', signals: ['a single fix'] },
          { what: 'several changes', signals: ['"also"'] }
        ]
      },
      credential: { type: 'noul', instructions: { question: 'Does `ticket` ask for a credential?', inspect: 'ticket' }, criteria: { true: { what: 'asks for a password' }, false: { what: 'does not' } } }
    });
    // Verbatim means the same object identity survives the rename, not a copy or a stringification.
    const team = sent[0]?.questions['team'] as { readonly criteria: Record<string, unknown> } | undefined;
    expect(team?.criteria['billing']).toBe(structured.team.options.billing);
  });

  it('omits `criteria` entirely for a Noul that declared no means', async () => {
    const { strategy, sent } = strategyOver({ answers: { any: { type: 'noul', noul: 0.2 } } });
    await strategy.decide({ state: 'x', questions: { any: llmNoulQuestion('is it so?') }, model: DECISION_MODEL });

    expect(sent[0]?.questions['any']).toEqual({ type: 'noul', instructions: 'is it so?' });
  });

  it('carries the EXACT synchronous cost into usage: what the completion path can never report', async () => {
    const { strategy } = strategyOver(SOUND_REPLY);
    const result = await strategy.decide({ state: 'x', questions: QUESTIONS, model: DECISION_MODEL });

    expect(result.usage).toEqual({ promptTokens: 3800, completionTokens: 0, totalTokens: 3800, cost: 0.000046 });
    expect(result.model).toBe('typesafe/jev-1.14');
    expect(result.generationId).toBe('gen-abc');
    expect(result.provider).toBe('TypeSafe');
  });

  it('keeps the result keys in order', async () => {
    const { strategy } = strategyOver(SOUND_REPLY);
    const result = await strategy.decide({ state: 'x', questions: QUESTIONS, model: DECISION_MODEL });

    expect(Object.keys(result)).toEqual(['model', 'answers', 'usage', 'generationId', 'provider']);
  });

  it('THROWS on an off-option answer rather than returning half an answer set', async () => {
    const { strategy } = strategyOver({ answers: { row: { type: 'choice', choice: 'row-z' }, heat: { type: 'score', score: 1 }, any: { type: 'noul', noul: 0.5 } } });

    await expect(strategy.decide({ state: 'x', questions: QUESTIONS, model: DECISION_MODEL })).rejects.toBeInstanceOf(LlmDecisionAnswerFaultError);
  });

  it('declares the decisions transport kind, so a ledger row can never confuse it with the completion lane', () => {
    const strategy = makeLlmOpenRouterDecisionStrategy({ apiKey: 'k', id: 'account-a' });

    expect(strategy.id).toBe('account-a');
    expect(strategy.kind).toBe(LLM_OPENROUTER_DECISION_STRATEGY_KIND);
    expect(LLM_OPENROUTER_DECISION_STRATEGY_KIND).toBe('openrouter-decisions');
  });

  it('reports a key-less instance as not ready, and never throws doing so', async () => {
    expect(await makeLlmOpenRouterDecisionStrategy({}).healthCheck?.()).toEqual({ ready: false, issues: [{ severity: 'error', message: expect.stringContaining('apiKey') }] });
    expect(await makeLlmOpenRouterDecisionStrategy({ decisionsCreate: async () => ({}) }).healthCheck?.()).toEqual({ ready: true, issues: [] });
  });

  it('is ready with a dummy key (construct-only: the real SDK loads, no request is sent)', async () => {
    const requests: string[] = [];
    const strategy = makeLlmOpenRouterDecisionStrategy({
      apiKey: 'sk-dummy',
      decisionsFetch: async (input) => {
        requests.push(String(input));
        return new Response('{}');
      }
    });

    expect(await strategy.healthCheck?.()).toEqual({ ready: true, issues: [] });
    expect(requests).toEqual([]);
  });

  it('rejects a key-less decide with a non-retryable transport error', async () => {
    const thrown = await makeLlmOpenRouterDecisionStrategy({ id: 'account-a' })
      .decide({ state: 'x', questions: QUESTIONS, model: DECISION_MODEL })
      .then(
        () => undefined,
        (error: unknown) => error
      );

    expect(thrown).toBeInstanceOf(LlmDecisionTransportError);
    expect((thrown as LlmDecisionTransportError).status).toBeUndefined();
    expect((thrown as LlmDecisionTransportError).message).toContain("'account-a'");
    expect(isRetryableLlmDecisionError(thrown)).toBe(false);
  });

  it("hands the seam the call's timeout (options, else the strategy's, else the default) and forwards the signal", async () => {
    const defaulted = strategyOver(SOUND_REPLY);
    await defaulted.strategy.decide({ state: 'x', questions: QUESTIONS, model: DECISION_MODEL });

    const configured = { sent: [] as LlmDecisionRequestBody[], options: [] as Array<LlmOpenRouterDecisionsCreateOptions | undefined> };
    const strategy = makeLlmOpenRouterDecisionStrategy({
      timeoutMs: 4_000,
      decisionsCreate: async (body, options) => {
        configured.sent.push(body);
        configured.options.push(options);
        return SOUND_REPLY;
      }
    });
    const controller = new AbortController();
    await strategy.decide({ state: 'x', questions: QUESTIONS, model: DECISION_MODEL });
    await strategy.decide({ state: 'x', questions: QUESTIONS, model: DECISION_MODEL }, { timeout: 1_500, signal: controller.signal });

    expect(defaulted.options[0]).toEqual({ timeoutMs: DEFAULT_LLM_DECISION_TIMEOUT_MS });
    expect(configured.options[0]).toEqual({ timeoutMs: 4_000 });
    expect(configured.options[1]).toEqual({ timeoutMs: 1_500, signal: controller.signal });
  });

  it('probes credentials against the SAME free key endpoint the completion sibling uses', async () => {
    const urls: string[] = [];
    const strategy = makeLlmOpenRouterDecisionStrategy({
      apiKey: 'k',
      probeFetch: async (url) => {
        urls.push(url);
        return { ok: true, status: 200, text: async () => '{}' };
      }
    });
    const health = await strategy.credentialProbe?.();

    expect(urls).toEqual(['https://openrouter.ai/api/v1/key']);
    expect(health?.ready).toBe(true);
  });
});

describe('llmUsageFromOpenRouterDecisionsUsage()', () => {
  it('is undefined for an absent usage block', () => {
    expect(llmUsageFromOpenRouterDecisionsUsage(undefined)).toBeUndefined();
    expect(llmUsageFromOpenRouterDecisionsUsage(null)).toBeUndefined();
  });

  it('flattens input / output / cost onto the completion spelling', () => {
    expect(llmUsageFromOpenRouterDecisionsUsage({ inputTokens: 3800, outputTokens: 0, cost: 0.000046 })).toEqual({ promptTokens: 3800, completionTokens: 0, totalTokens: 3800, cost: 0.000046 });
  });

  it('omits cost when the reply carried none', () => {
    expect(llmUsageFromOpenRouterDecisionsUsage({ inputTokens: 10, outputTokens: 2 })).toEqual({ promptTokens: 10, completionTokens: 2, totalTokens: 12 });
  });

  it('totals a lone side', () => {
    expect(llmUsageFromOpenRouterDecisionsUsage({ inputTokens: 5 })).toEqual({ promptTokens: 5, completionTokens: 0, totalTokens: 5 });
  });

  it('zeroes an empty usage block', () => {
    expect(llmUsageFromOpenRouterDecisionsUsage({})).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });
});

describe('the real SDK path over a fake socket', () => {
  /**
   * A fake socket that records every request the SDK sends and answers each with the given response.
   *
   * @param respond - Builds the response for a request.
   * @returns The strategy config seam plus the recorded requests.
   */
  function socketOver(respond: (request: Request) => Response | Promise<Response>) {
    const requests: Request[] = [];
    return {
      requests,
      decisionsFetch: async (input: string | URL | Request, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init);
        requests.push(request);
        return respond(request);
      }
    };
  }

  /**
   * A socket answer that never arrives: it rejects with the request signal's reason once the signal aborts.
   *
   * @param request - The request the SDK sent.
   * @returns A promise that settles only on abort.
   */
  function hang(request: Request): Promise<Response> {
    return new Promise((_resolve, reject) => {
      if (request.signal.aborted) {
        reject(request.signal.reason);
      } else {
        request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true });
      }
    });
  }

  async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
    return promise.then(
      () => undefined,
      (error: unknown) => error
    );
  }

  const WIRE_REPLY = { id: 'gen-dec-1', model: 'typesafe/jev-1.14-20260917', provider: 'TypeSafe', answers: { any: { type: 'noul', noul: 0.67 } }, usage: { input_tokens: 272, output_tokens: 20, cost: 0.000011424 } };

  it('POSTs to `https://openrouter.ai/api/v1/systemone` with the bearer key, and a configured `baseUrl` governs it', async () => {
    // The `systemOne` operation resolves against the CLIENT root, so `baseUrl` reaches the decision. The trailing
    // slash case guards the strategy's own trim, which is what keeps the two forms one URL.
    const cases = [
      { baseUrl: undefined, url: 'https://openrouter.ai/api/v1/systemone' },
      { baseUrl: 'https://openrouter.ai/api/v1/', url: 'https://openrouter.ai/api/v1/systemone' },
      { baseUrl: 'https://gateway.test/api/v1', url: 'https://gateway.test/api/v1/systemone' }
    ];

    for (const { baseUrl, url } of cases) {
      const socket = socketOver(() => new Response(JSON.stringify(WIRE_REPLY), { status: 200, headers: { 'content-type': 'application/json' } }));
      const strategy = makeLlmOpenRouterDecisionStrategy({ apiKey: 'sk-test', decisionsFetch: socket.decisionsFetch, ...(baseUrl == null ? {} : { baseUrl }) });
      const result = await strategy.decide({ state: { phrase: 'on the pile' }, questions: { any: QUESTIONS.any }, model: DECISION_MODEL });

      expect(socket.requests.map((request) => `${request.method} ${request.url}`)).toEqual([`POST ${url}`]);
      expect(socket.requests[0]?.headers.get('authorization')).toBe('Bearer sk-test');
      expect(JSON.parse(await socket.requests[0]!.text())).toEqual({ model: DECISION_MODEL, state: { phrase: 'on the pile' }, questions: { any: { type: 'noul', instructions: QUESTIONS.any.instructions, criteria: { true: 'one of them fits', false: 'none of them fit' } } } });
      expect(result.answers.any.noul).toBe(0.67);
      expect(result.usage?.cost).toBe(0.000011424);
    }
  });

  it('surfaces a 404 as a non-retryable transport error carrying the status, never as an answer', async () => {
    const socket = socketOver(() => new Response(JSON.stringify({ error: { message: 'Not Found', code: 404 } }), { status: 404, headers: { 'content-type': 'application/json' } }));
    const strategy = makeLlmOpenRouterDecisionStrategy({ apiKey: 'sk-test', decisionsFetch: socket.decisionsFetch });
    const thrown = await thrownBy(strategy.decide({ state: { phrase: 'on the pile' }, questions: { any: QUESTIONS.any }, model: DECISION_MODEL }));

    expect(thrown).toBeInstanceOf(LlmDecisionTransportError);
    expect((thrown as LlmDecisionTransportError).status).toBe(404);
    expect((thrown as LlmDecisionTransportError).message).toContain('Not Found');
    expect(isRetryableLlmDecisionError(thrown)).toBe(false);
  });

  it('surfaces a 429 as a retryable transport error', async () => {
    const socket = socketOver(() => new Response(JSON.stringify({ error: { message: 'Rate limited', code: 429 } }), { status: 429, headers: { 'content-type': 'application/json' } }));
    const strategy = makeLlmOpenRouterDecisionStrategy({ apiKey: 'sk-test', decisionsFetch: socket.decisionsFetch });
    const thrown = await thrownBy(strategy.decide({ state: 'x', questions: { any: QUESTIONS.any }, model: DECISION_MODEL }));

    expect(thrown).toBeInstanceOf(LlmDecisionTransportError);
    expect((thrown as LlmDecisionTransportError).status).toBe(429);
    expect(isRetryableLlmDecisionError(thrown)).toBe(true);
  });

  it('holds the timeout even when the caller passes a signal, rejecting with the native TimeoutError', async () => {
    const socket = socketOver(hang);
    const strategy = makeLlmOpenRouterDecisionStrategy({ apiKey: 'sk-test', timeoutMs: 20, decisionsFetch: socket.decisionsFetch });
    const thrown = await thrownBy(strategy.decide({ state: 'x', questions: { any: QUESTIONS.any }, model: DECISION_MODEL }, { signal: new AbortController().signal }));

    expect((thrown as Error).name).toBe('TimeoutError');
    expect(isAbortError(thrown)).toBe(true);
    expect(isRetryableLlmDecisionError(thrown)).toBe(false);
  });

  it("rejects a caller abort with the caller's reason, not a transport error", async () => {
    const socket = socketOver(hang);
    const strategy = makeLlmOpenRouterDecisionStrategy({ apiKey: 'sk-test', decisionsFetch: socket.decisionsFetch });
    const controller = new AbortController();
    const pending = thrownBy(strategy.decide({ state: 'x', questions: { any: QUESTIONS.any }, model: DECISION_MODEL }, { signal: controller.signal }));
    setTimeout(() => controller.abort(), 5);
    const thrown = await pending;

    expect(thrown).not.toBeInstanceOf(LlmDecisionTransportError);
    expect((thrown as Error).name).toBe('AbortError');
    expect(isAbortError(thrown)).toBe(true);
  });

  it('rethrows a socket failure as the native fetch error, which is retryable', async () => {
    const socket = socketOver(() => {
      throw new TypeError('fetch failed');
    });
    const strategy = makeLlmOpenRouterDecisionStrategy({ apiKey: 'sk-test', decisionsFetch: socket.decisionsFetch });
    const thrown = await thrownBy(strategy.decide({ state: 'x', questions: { any: QUESTIONS.any }, model: DECISION_MODEL }));

    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toBe('fetch failed');
    expect(isRetryableLlmDecisionError(thrown)).toBe(true);
  });
});
