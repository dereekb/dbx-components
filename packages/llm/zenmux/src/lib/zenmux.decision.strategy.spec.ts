import { isRetryableLlmDecisionError, llmChoiceQuestion, LlmDecisionAnswerFaultError, LlmDecisionTransportError, llmNoulQuestion, llmScoreQuestion, type LlmDecisionRequest } from '@dereekb/llm';
import { makeLlmSystemOneWireFake, llmFetchFakeRequestOf, type LlmFetchFakeRequest } from '@dereekb/llm/test';
import { describe, expect, it } from 'vitest';
import { makeZenmuxDecisionStrategy, ZENMUX_DECISION_STRATEGY_KIND, ZENMUX_REQUEST_ID_HEADER } from './zenmux.decision.strategy';

/**
 * ZenMux's hooks over the core System One transport, run over the one `/systemone` wire fake. Only ZenMux's own facts are
 * pinned here (its route, its header id, its lax answer types, its list-price cost, its probe); every shared behaviour is
 * pinned once in the core transport's spec.
 */

const MODEL = 'typesafe/jev-1.14';

const QUESTIONS = {
  is_urgent: llmNoulQuestion('Does this convey urgency?'),
  department: llmChoiceQuestion('Which team should handle this?', { billing: 'Payments, invoicing, refunds', technical: 'Bugs, outages, integrations', sales: 'Pricing, upgrades, new accounts' }),
  frustration: llmScoreQuestion('How frustrated is the customer?', ['Calm', 'Frustrated', 'Very angry'])
};

const STATE = 'Help! My payouts have been failing for 3 days.';

const REQUEST = { state: STATE, questions: QUESTIONS, model: MODEL };

const TYPED_ANSWERS = {
  is_urgent: { type: 'noul', noul: 0.94 },
  department: { type: 'choice', choice: 'billing', probabilities: { billing: 0.9, technical: 0.08, sales: 0.02 }, confidence: 0.9 },
  frustration: { type: 'score', score: 1.4 }
};

function fakeSocket(status: number, body: unknown, headers?: Readonly<Record<string, string>>) {
  const fake = makeLlmSystemOneWireFake({ respond: { status, body, ...(headers == null ? {} : { headers }) } });
  return { sent: fake.requests, decisionFetch: fake.fetch };
}

async function thrownBy(status: number, body: unknown): Promise<unknown> {
  const { decisionFetch } = fakeSocket(status, body);
  return makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch })
    .decide(REQUEST)
    .then(
      () => undefined,
      (error: unknown) => error
    );
}

describe('makeZenmuxDecisionStrategy()', () => {
  it('sends the documented POST /systemone call: Bearer auth, a JSON body of EXACTLY {model, state, questions}', async () => {
    const { sent, decisionFetch } = fakeSocket(200, { model: MODEL, answers: TYPED_ANSWERS });
    await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch }).decide(REQUEST);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe('https://zenmux.ai/api/v1/systemone');
    expect(sent[0]?.init.method).toBe('POST');
    expect(sent[0]?.init.headers).toEqual({ Authorization: 'Bearer sk-zen', 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(JSON.parse(sent[0]?.init.body ?? '')).toEqual({
      model: MODEL,
      state: 'Help! My payouts have been failing for 3 days.',
      questions: {
        is_urgent: { type: 'noul', instructions: 'Does this convey urgency?' },
        department: { type: 'choice', instructions: 'Which team should handle this?', criteria: { billing: 'Payments, invoicing, refunds', technical: 'Bugs, outages, integrations', sales: 'Pricing, upgrades, new accounts' } },
        frustration: { type: 'score', instructions: 'How frustrated is the customer?', criteria: ['Calm', 'Frustrated', 'Very angry'] }
      }
    });
  });

  it('sends the body keys in the order model, state, questions — compared as the raw string', async () => {
    const { sent, decisionFetch } = fakeSocket(200, { answers: { is_urgent: TYPED_ANSWERS.is_urgent } });
    await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch }).decide({ state: STATE, questions: { is_urgent: QUESTIONS.is_urgent }, model: MODEL });

    expect(sent[0]?.init.body).toBe(`{"model":"${MODEL}","state":"${STATE}","questions":{"is_urgent":{"type":"noul","instructions":"Does this convey urgency?"}}}`);
  });

  it('never leaks a host-extended request field onto the wire: ZenMux answers 400 to any extra key', async () => {
    const { sent, decisionFetch } = fakeSocket(200, { answers: TYPED_ANSWERS });
    const extended = { ...REQUEST, sessionId: 's', meta: { run: 'r1' } } as LlmDecisionRequest<typeof QUESTIONS>;
    await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch }).decide(extended);

    expect(Object.keys(JSON.parse(sent[0]?.init.body ?? '{}'))).toEqual(['model', 'state', 'questions']);
  });

  it('describes itself by its route and keeps the stable zenmux-systemone kind', () => {
    expect(makeZenmuxDecisionStrategy({ apiKey: 'sk-zen' }).describe).toBe('ZenMux System One at https://zenmux.ai/api/v1/systemone');
    expect(ZENMUX_DECISION_STRATEGY_KIND).toBe('zenmux-systemone');
  });

  it('honours a configured base URL, trailing slash and all', async () => {
    const { sent, decisionFetch } = fakeSocket(200, { answers: TYPED_ANSWERS });
    await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', baseUrl: 'https://zenmux.test/api/v1/', decisionFetch }).decide(REQUEST);

    expect(sent[0]?.url).toBe('https://zenmux.test/api/v1/systemone');
  });

  it('reads a typed reply: answers, the answering model, the generation id and the provider', async () => {
    const { decisionFetch } = fakeSocket(200, { id: 'gen-zen-1', model: 'typesafe/jev-1.14-20260901', provider: 'TypeSafe', answers: TYPED_ANSWERS });
    const result = await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch }).decide(REQUEST);

    expect(result.answers.is_urgent.noul).toBe(0.94);
    expect(result.answers.department.choice).toBe('billing');
    expect(result.answers.frustration.score).toBe(1.4);
    expect(result.model).toBe('typesafe/jev-1.14-20260901');
    expect(result.generationId).toBe('gen-zen-1');
    expect(result.provider).toBe('TypeSafe');
  });

  it('reads the RECORDED live reply (2026-10-01, subscription key): typed answers with extra fields, token usage, no cost / id / provider', async () => {
    const live = {
      model: MODEL,
      answers: {
        is_urgent: { type: 'noul', noul: 0.95 },
        department: { type: 'choice', choice: 'billing', confidence: 0.84, probabilities: { sales: 0, technical: 0.11, billing: 0.89 } },
        frustration: { type: 'score', score: 1.04, confidence: 0.94, legend: { '0': 'Calm', '1': 'Frustrated', '2': 'Very angry' }, probabilities: { '0': 0, '1': 0.96, '2': 0.04 } }
      },
      usage: { input_tokens: 402, output_tokens: 73 }
    };
    const { decisionFetch } = fakeSocket(200, live);
    const result = await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch }).decide(REQUEST);

    expect(result.answers.is_urgent.noul).toBe(0.95);
    expect(result.answers.department.choice).toBe('billing');
    expect(result.answers.frustration.score).toBe(1.04);
    expect(result.model).toBe(MODEL);
    expect(result.usage).toEqual({ promptTokens: 402, completionTokens: 73, totalTokens: 475 });
    expect(result.generationId).toBeUndefined();
    expect(result.provider).toBeUndefined();
  });

  it('reads the generation id off the X-ZenMux-RequestId header: the RECORDED live reply (2026-10-02) carries none in its body', async () => {
    const live = { model: MODEL, answers: { is_urgent: { type: 'noul', noul: 0.99 } }, usage: { input_tokens: 278, output_tokens: 20 } };
    const { decisionFetch } = fakeSocket(200, live, { [ZENMUX_REQUEST_ID_HEADER]: '95acf10d7cc040d9bdbfe5d3b9f5037b' });
    const result = await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch }).decide({ state: STATE, questions: { is_urgent: QUESTIONS.is_urgent }, model: MODEL });

    expect(result.generationId).toBe('95acf10d7cc040d9bdbfe5d3b9f5037b');
  });

  it('prefers a body id over the header, and reads a blank header as no id', async () => {
    const both = fakeSocket(200, { id: 'gen-body', answers: TYPED_ANSWERS }, { [ZENMUX_REQUEST_ID_HEADER]: 'gen-header' });
    const blank = fakeSocket(200, { answers: TYPED_ANSWERS }, { [ZENMUX_REQUEST_ID_HEADER]: '' });

    expect((await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch: both.decisionFetch }).decide(REQUEST)).generationId).toBe('gen-body');
    expect((await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch: blank.decisionFetch }).decide(REQUEST)).generationId).toBeUndefined();
  });

  it('reads a reply whose answers carry NO `type`, typing each from the question that asked it', async () => {
    const { decisionFetch } = fakeSocket(200, { answers: { is_urgent: { noul: 0.2 }, department: { choice: 'technical' }, frustration: { score: 0.5 } } });
    const result = await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch }).decide(REQUEST);

    expect(result.answers.is_urgent).toEqual({ type: 'noul', noul: 0.2 });
    expect(result.answers.department).toEqual({ type: 'choice', choice: 'technical' });
    expect(result.answers.frustration).toEqual({ type: 'score', score: 0.5 });
    // No model echoed ⇒ the requested slug stands.
    expect(result.model).toBe(MODEL);
  });

  it('THROWS on a present-but-wrong type, an off-option choice and a missing answer: membership is never relaxed', async () => {
    const mistyped = await thrownBy(200, { answers: { ...TYPED_ANSWERS, is_urgent: { type: 'choice', choice: 'billing' } } });
    const offOption = await thrownBy(200, { answers: { ...TYPED_ANSWERS, department: { type: 'choice', choice: 'legal' } } });
    const missing = await thrownBy(200, { answers: { is_urgent: TYPED_ANSWERS.is_urgent } });

    expect(mistyped).toBeInstanceOf(LlmDecisionAnswerFaultError);
    expect(offOption).toBeInstanceOf(LlmDecisionAnswerFaultError);
    expect(missing).toBeInstanceOf(LlmDecisionAnswerFaultError);
  });

  it('folds snake_case usage into the usage spelling, keeping a reported cost on the list basis', async () => {
    const { decisionFetch } = fakeSocket(200, { answers: TYPED_ANSWERS, usage: { input_tokens: 350, output_tokens: 34, cost: 0.0000147 } });
    const result = await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch }).decide(REQUEST);

    expect(result.usage).toEqual({ promptTokens: 350, completionTokens: 34, totalTokens: 384, cost: 0.0000147, costBasis: 'list' });
  });

  it('leaves an unreported cost ABSENT (unknown, never zero) and omits usage the reply did not send', async () => {
    const partial = fakeSocket(200, { answers: TYPED_ANSWERS, usage: { input_tokens: 120 } });
    const none = fakeSocket(200, { answers: TYPED_ANSWERS });
    const withPartial = await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch: partial.decisionFetch }).decide(REQUEST);
    const withNone = await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen', decisionFetch: none.decisionFetch }).decide(REQUEST);

    expect(withPartial.usage).toEqual({ promptTokens: 120, completionTokens: 0, totalTokens: 120 });
    expect(withNone.usage).toBeUndefined();
  });

  it('classifies a 429 / 500 as retryable and a 400 as not, carrying the provider’s own words', async () => {
    const limited = await thrownBy(429, { error: { message: 'Rate limit exceeded' } });
    const overloaded = await thrownBy(500, 'upstream overloaded');
    const refused = await thrownBy(400, { error: { message: "model 'gpt-x' is not a System One model" } });

    expect(limited).toBeInstanceOf(LlmDecisionTransportError);
    expect((limited as LlmDecisionTransportError).status).toBe(429);
    expect((limited as LlmDecisionTransportError).message).toContain('Rate limit exceeded');
    expect(isRetryableLlmDecisionError(limited)).toBe(true);
    expect(isRetryableLlmDecisionError(overloaded)).toBe(true);
    expect(isRetryableLlmDecisionError(refused)).toBe(false);
    expect((refused as LlmDecisionTransportError).message).toContain('is not a System One model');
  });

  it('refuses to send with no key and no injected socket, naming the key’s env var', async () => {
    const thrown = await makeZenmuxDecisionStrategy({ apiKeyEnv: 'HOST_ZENMUX_API_KEY' })
      .decide(REQUEST)
      .catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(LlmDecisionTransportError);
    expect((thrown as LlmDecisionTransportError).message).toBe("ZenMux decision strategy 'zenmux-systemone': no apiKey configured and no decisionFetch injected (set HOST_ZENMUX_API_KEY, or gate startup via the readiness check).");
  });

  it('registers under its provider id with the zenmux-systemone transport kind', () => {
    const named = makeZenmuxDecisionStrategy({ id: 'zenmux-payg', apiKey: 'sk-zen' });
    const bare = makeZenmuxDecisionStrategy({ apiKey: 'sk-zen' });

    expect(named.id).toBe('zenmux-payg');
    expect(named.kind).toBe(ZENMUX_DECISION_STRATEGY_KIND);
    expect(bare.id).toBe(ZENMUX_DECISION_STRATEGY_KIND);
  });
});

describe('makeZenmuxDecisionStrategy() readiness', () => {
  it('healthCheck names the key’s env var (or asks for an apiKey) when no key is set, and is ready otherwise', async () => {
    expect(await makeZenmuxDecisionStrategy({ id: 'zenmux', apiKeyEnv: 'HOST_ZENMUX_API_KEY' }).healthCheck?.()).toEqual({ ready: false, issues: [{ severity: 'error', message: "no decisions API key is configured for 'zenmux': set HOST_ZENMUX_API_KEY" }] });
    expect(await makeZenmuxDecisionStrategy({ id: 'zenmux' }).healthCheck?.()).toEqual({ ready: false, issues: [{ severity: 'error', message: "no decisions API key is configured for 'zenmux': pass an apiKey" }] });
    expect(await makeZenmuxDecisionStrategy({ apiKey: 'sk-zen' }).healthCheck?.()).toEqual({ ready: true, issues: [] });
    expect(await makeZenmuxDecisionStrategy({ decisionFetch: fakeSocket(200, {}).decisionFetch }).healthCheck?.()).toEqual({ ready: true, issues: [] });
  });

  it('credentialProbe asks the auth-gated sentinel question (not /models, which ZenMux answers 200 to any key)', async () => {
    const probed: LlmFetchFakeRequest[] = [];
    const live = makeZenmuxDecisionStrategy({
      id: 'zenmux',
      apiKey: 'sk-zen',
      probeFetch: async (input, init) => {
        probed.push(llmFetchFakeRequestOf(input, init));
        return new Response('{"error":{"type":"invalid_model","message":"Requested model is not valid"}}', { status: 404 });
      }
    });
    const revoked = makeZenmuxDecisionStrategy({ id: 'zenmux', apiKey: 'sk-zen', probeFetch: async () => new Response('{"error":{"message":"Invalid API key"}}', { status: 401 }) });

    expect(await live.credentialProbe?.()).toEqual({ ready: true, issues: [] });
    expect(probed[0]?.url).toBe('https://zenmux.ai/api/v1/chat/completions');
    expect(probed[0]?.init.method).toBe('POST');
    expect(probed[0]?.init.headers['Authorization']).toBe('Bearer sk-zen');
    expect((await revoked.credentialProbe?.())?.ready).toBe(false);
    expect((await revoked.credentialProbe?.())?.issues[0]?.message).toContain('Invalid API key');
  });

  it('credentialProbe is ready for an injected fake and unready, without a request, for a missing key', async () => {
    expect(await makeZenmuxDecisionStrategy({ decisionFetch: fakeSocket(200, {}).decisionFetch }).credentialProbe?.()).toEqual({ ready: true, issues: [] });
    expect(await makeZenmuxDecisionStrategy({ apiKeyEnv: 'HOST_ZENMUX_API_KEY' }).credentialProbe?.()).toEqual({ ready: false, issues: [{ severity: 'error', message: 'no apiKey configured and no decisionFetch injected (set HOST_ZENMUX_API_KEY)' }] });
  });
});
