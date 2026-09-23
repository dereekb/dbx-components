import { describe, expect, it } from 'vitest';
import { fakeOpenRouterDecisionClient } from '../test/openrouter.fake';
import { validateOpenRouterModelConfig } from './openrouter.config';
import { OpenRouterSystemOneModelOnCompletionArmError, openRouterResponsesRequestBody } from './openrouter.call';
import {
  OpenRouterDecisionAnswerFaultError,
  OpenRouterDecisionDeclarationError,
  openRouterDecisionRequest,
  openRouterDecisionRequestBody,
  openRouterDecisionWireQuestion,
  openRouterRunUsageFromDecisionsUsage,
  readOpenRouterDecisionAnswers,
  splitOpenRouterDecisionModelConfig,
  validateOpenRouterDecisionRequest
} from './openrouter.decision';
import { openRouterDecision } from './openrouter.decision.call';
import { type OpenRouterDecisionAnswer, type OpenRouterDecisionQuestions, openRouterChoiceQuestion, openRouterNoulQuestion, openRouterScoreQuestion } from './openrouter.decision.question';
import { OPENROUTER_JEV_1_13_MODEL_ID } from './openrouter.type';

const JEV = OPENROUTER_JEV_1_13_MODEL_ID;

const QUESTIONS = {
  entry: openRouterChoiceQuestion('Which entry means what `phrase` describes?', { 'row-a': 'the first row', 'row-b': null }),
  heat: openRouterScoreQuestion('How urgent is `phrase`?', ['idle', 'soon', 'now']),
  fits: openRouterNoulQuestion('At least one row means what `phrase` describes.', { true: 'one of them fits', false: 'none of them fit' })
} satisfies OpenRouterDecisionQuestions;

describe('openRouterDecisionWireQuestion()', () => {
  it('should spell an undescribed Choice option as an explicit null', () => {
    // Omitting the key would remove the option from the answer space; null keeps it, undescribed.
    const wire = openRouterDecisionWireQuestion(QUESTIONS.entry) as { criteria: Record<string, unknown> };
    expect(wire.criteria['row-a']).toBe('the first row');
    expect(wire.criteria['row-b']).toBeNull();
  });

  it('should carry Score levels as an ordered criteria array', () => {
    const wire = openRouterDecisionWireQuestion(QUESTIONS.heat) as unknown as { criteria: unknown[] };
    expect(wire.criteria).toEqual(['idle', 'soon', 'now']);
  });

  it('should carry a Noul`s two sides as criteria', () => {
    const wire = openRouterDecisionWireQuestion(QUESTIONS.fits) as { criteria: Record<string, unknown> };
    expect(wire.criteria).toEqual({ true: 'one of them fits', false: 'none of them fit' });
  });

  it('should omit criteria entirely for a Noul with no declared sides', () => {
    // Not an empty object — the key is absent, which is what the wire means by "undefined condition".
    expect('criteria' in openRouterDecisionWireQuestion(openRouterNoulQuestion('is it urgent?'))).toBe(false);
  });

  it('should pass a structured entry through by identity', () => {
    // The wire carries declaration guidance VERBATIM, so a normalising copy here would be a silent edit.
    const criterion = { what: 'Charges, invoices, refunds', not_for: 'Order tracking', examples: ['I was charged twice'] };
    const wire = openRouterDecisionWireQuestion(openRouterChoiceQuestion('which?', { billing: criterion })) as { criteria: Record<string, unknown> };
    expect(wire.criteria['billing']).toBe(criterion);
  });
});

describe('splitOpenRouterDecisionModelConfig()', () => {
  it('should keep only the keys the decisions route accepts', () => {
    const split = splitOpenRouterDecisionModelConfig({ model: JEV, provider: { only: ['typesafe'] }, user: 'u', temperature: 0.5, text: { verbosity: 'low' } });
    expect(split.requestConfig).toEqual({ model: JEV, provider: { only: ['typesafe'] }, user: 'u' });
  });

  it('should report what it dropped rather than discarding it quietly', () => {
    const split = splitOpenRouterDecisionModelConfig({ model: JEV, temperature: 0.5, reasoning: { effort: 'high' } });
    expect(split.dropped).toEqual(['temperature', 'reasoning']);
  });

  it('should keep the execution timeout off the request body', () => {
    const split = splitOpenRouterDecisionModelConfig({ model: JEV, requestTimeoutMs: 5000 });
    expect(split.requestTimeoutMs).toBe(5000);
    expect(split.dropped).toEqual([]);
    expect(split.requestConfig).toEqual({ model: JEV });
  });

  it('should handle a null config', () => {
    expect(splitOpenRouterDecisionModelConfig(null).requestConfig).toEqual({});
  });
});

describe('validateOpenRouterDecisionRequest()', () => {
  it('should accept a System One model', () => {
    expect(validateOpenRouterDecisionRequest({ config: { model: JEV }, state: 'x', questions: QUESTIONS }).valid).toBe(true);
  });

  it('should refuse a chat model, naming the other arm', () => {
    const validation = validateOpenRouterDecisionRequest({ config: { model: 'openai/gpt-5.1' }, state: 'x', questions: QUESTIONS });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('is not a System One model');
    expect(validation.errors[0]).toContain('callModelForOpenRouterRequest');
  });

  it('should refuse a request with no model', () => {
    expect(validateOpenRouterDecisionRequest({ config: {}, state: 'x', questions: QUESTIONS }).valid).toBe(false);
  });

  it('should warn about config keys the route has no equivalent for', () => {
    const validation = validateOpenRouterDecisionRequest({ config: { model: JEV, temperature: 0.2 }, state: 'x', questions: QUESTIONS });
    expect(validation.valid).toBe(true);
    expect(validation.warnings[0]).toContain('`temperature`');
  });

  it('should fold question problems into the same result', () => {
    const validation = validateOpenRouterDecisionRequest({ config: { model: JEV }, state: 'x', questions: { bad: openRouterNoulQuestion('') } });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('`bad`');
  });
});

describe('System One model routing', () => {
  it('should refuse a System One model on the completion arm at the one point every dispatch path builds its body', () => {
    expect(() => openRouterResponsesRequestBody({ config: { model: JEV }, input: [{ role: 'user', content: 'hi' }] })).toThrow(OpenRouterSystemOneModelOnCompletionArmError);
  });

  it('should refuse a System One model hiding in the fallback chain', () => {
    expect(() => openRouterResponsesRequestBody({ config: { model: 'openai/gpt-5.1', models: ['openai/gpt-5.1', 'jev-latest'] }, input: [] })).toThrow(OpenRouterSystemOneModelOnCompletionArmError);
  });

  it('should leave a chat model alone', () => {
    expect(() => openRouterResponsesRequestBody({ config: { model: 'openai/gpt-5.1' }, input: [] })).not.toThrow();
  });

  it('should refuse a System One model at publish time on a chat config', () => {
    const validation = validateOpenRouterModelConfig({ model: JEV });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('openRouterDecision');
  });

  it('should refuse a chat model at publish time on a decision config', () => {
    const validation = validateOpenRouterModelConfig({ model: 'openai/gpt-5.1' }, { decision: true });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('is not a System One model');
  });

  it('should warn that a fallback chain has no meaning on a decision', () => {
    const validation = validateOpenRouterModelConfig({ model: JEV, models: [JEV] }, { decision: true });
    expect(validation.valid).toBe(true);
    expect(validation.warnings.some((x) => x.includes('`models` has no meaning'))).toBe(true);
  });
});

describe('openRouterDecisionRequest()', () => {
  it('should merge caller questions over the prompt`s stored ones by id', () => {
    const request = openRouterDecisionRequest({
      prompt: { promptKey: 'p', version: 1, config: { model: JEV }, questions: { fits: QUESTIONS.fits, heat: QUESTIONS.heat } },
      state: { phrase: 'on the pile' },
      questions: { heat: openRouterScoreQuestion('overridden', ['a', 'b']) }
    });

    expect(Object.keys(request.questions).sort()).toEqual(['fits', 'heat']);
    expect((request.questions['heat'] as { instructions: string }).instructions).toBe('overridden');
  });

  it('should merge the prompt config under the caller overrides', () => {
    const request = openRouterDecisionRequest({ prompt: { promptKey: 'p', version: 1, config: { model: JEV, user: 'a' } }, state: 'x', questions: QUESTIONS, overrides: { user: 'b' } });
    expect(request.config).toEqual({ model: JEV, user: 'b' });
  });

  it('should refuse a bad declaration before a request exists', () => {
    expect(() => openRouterDecisionRequest({ state: 'x', questions: { bad: openRouterNoulQuestion('') } })).toThrow(OpenRouterDecisionDeclarationError);
  });
});

describe('openRouterDecisionRequestBody()', () => {
  it('should build exactly the three keys the route needs', () => {
    const body = openRouterDecisionRequestBody({ config: { model: JEV }, state: { phrase: 'on the pile' }, questions: QUESTIONS });
    expect(Object.keys(body).sort()).toEqual(['model', 'questions', 'state']);
  });
});

describe('readOpenRouterDecisionAnswers()', () => {
  it('should pass a well formed reply through', () => {
    const read = readOpenRouterDecisionAnswers({ questions: QUESTIONS, raw: { entry: { type: 'choice', choice: 'row-a' }, heat: { type: 'score', score: 2 }, fits: { type: 'noul', noul: 0.9 } } });
    expect(read.faults).toBeUndefined();
    expect(read.answers?.fits.noul).toBe(0.9);
  });

  it('should fault a missing answer', () => {
    const read = readOpenRouterDecisionAnswers({ questions: { fits: QUESTIONS.fits }, raw: {} });
    expect(read.faults?.[0].kind).toBe('answer-missing');
  });

  it('should fault an answer of the wrong type', () => {
    const read = readOpenRouterDecisionAnswers({ questions: { fits: QUESTIONS.fits }, raw: { fits: { type: 'score', score: 1 } as OpenRouterDecisionAnswer } });
    expect(read.faults?.[0].kind).toBe('answer-mistyped');
  });

  it('should fault a choice outside the declared options', () => {
    const read = readOpenRouterDecisionAnswers({ questions: { entry: QUESTIONS.entry }, raw: { entry: { type: 'choice', choice: 'row-z' } } });
    expect(read.faults?.[0].kind).toBe('choice-off-option');
  });

  it('should fault a distribution over undeclared options', () => {
    const read = readOpenRouterDecisionAnswers({ questions: { entry: QUESTIONS.entry }, raw: { entry: { type: 'choice', choice: 'row-a', probabilities: { 'row-a': 0.5, 'row-z': 0.5 } } } });
    expect(read.faults?.some((x) => x.kind === 'choice-off-option')).toBe(true);
  });

  it('should fault a distribution that does not sum to 1', () => {
    const read = readOpenRouterDecisionAnswers({ questions: { entry: QUESTIONS.entry }, raw: { entry: { type: 'choice', choice: 'row-a', probabilities: { 'row-a': 0.2, 'row-b': 0.2 } } } });
    expect(read.faults?.[0].kind).toBe('value-out-of-range');
  });

  it('should tolerate float noise in a distribution', () => {
    const read = readOpenRouterDecisionAnswers({ questions: { entry: QUESTIONS.entry }, raw: { entry: { type: 'choice', choice: 'row-a', probabilities: { 'row-a': 0.7000001, 'row-b': 0.2999998 } } } });
    expect(read.faults).toBeUndefined();
  });

  it('should check nothing about an absent distribution', () => {
    // Only choice/score/noul are guaranteed on the wire; the rest absent is a real reply.
    const read = readOpenRouterDecisionAnswers({ questions: { entry: QUESTIONS.entry }, raw: { entry: { type: 'choice', choice: 'row-a' } } });
    expect(read.faults).toBeUndefined();
  });

  it('should fault a score outside the declared levels', () => {
    const read = readOpenRouterDecisionAnswers({ questions: { heat: QUESTIONS.heat }, raw: { heat: { type: 'score', score: 3 } } });
    expect(read.faults?.[0].kind).toBe('value-out-of-range');
  });

  it('should fault a noul outside 0..1', () => {
    const read = readOpenRouterDecisionAnswers({ questions: { fits: QUESTIONS.fits }, raw: { fits: { type: 'noul', noul: 1.2 } } });
    expect(read.faults?.[0].kind).toBe('value-out-of-range');
  });

  it('should collect every fault rather than only the first', () => {
    const read = readOpenRouterDecisionAnswers({ questions: QUESTIONS, raw: {} });
    expect(read.faults).toHaveLength(3);
  });
});

describe('openRouterRunUsageFromDecisionsUsage()', () => {
  it('should total the tokens and keep the cost', () => {
    expect(openRouterRunUsageFromDecisionsUsage({ inputTokens: 3800, outputTokens: 0, cost: 0.000046 })).toEqual({ inputTokens: 3800, outputTokens: 0, totalTokens: 3800, cost: 0.000046 });
  });

  it('should omit an unreported cost rather than carrying it as undefined', () => {
    // A spread `cost: undefined` reads downstream as "cost zero" rather than "cost unknown".
    const usage = openRouterRunUsageFromDecisionsUsage({ inputTokens: 10, outputTokens: 0 }) as Record<string, unknown>;
    expect('cost' in usage).toBe(false);
  });

  it('should handle an absent usage', () => {
    expect(openRouterRunUsageFromDecisionsUsage(null)).toBeUndefined();
  });
});

describe('openRouterDecision()', () => {
  it('should POST to the systemone route with exactly the declared body', async () => {
    // The URL is pinned deliberately: a fake injected ABOVE the SDK stays green no matter which route
    // the SDK resolves, which is how this endpoint was once shipped 404ing on every live call.
    const fake = fakeOpenRouterDecisionClient({ answers: { entry: { type: 'choice', choice: 'row-a' }, heat: { type: 'score', score: 1 }, fits: { type: 'noul', noul: 0.8 } } });
    const request = openRouterDecisionRequest({ state: { phrase: 'on the pile' }, questions: QUESTIONS, overrides: { model: JEV } });

    await openRouterDecision({ client: fake.client, request });

    expect(fake.callCount).toBe(1);
    expect(fake.requests[0].url).toBe('https://openrouter.ai/api/v1/systemone');
    expect(fake.requests[0].method).toBe('POST');
    expect(Object.keys(fake.requests[0].body).sort()).toEqual(['model', 'questions', 'state']);
    expect(fake.requests[0].body['model']).toBe(JEV);
    expect(fake.requests[0].body['state']).toEqual({ phrase: 'on the pile' });
    expect((fake.requests[0].body['questions'] as Record<string, { type: string }>)['entry'].type).toBe('choice');
  });

  it('should normalize the reply into the package result shape', async () => {
    const fake = fakeOpenRouterDecisionClient({ id: 'gen_x', answers: { fits: { type: 'noul', noul: 0.42 } }, inputTokens: 272, cost: 0.000011424 });
    const request = openRouterDecisionRequest({ state: 'x', questions: { fits: QUESTIONS.fits }, overrides: { model: JEV } });
    const result = await openRouterDecision({ client: fake.client, request });

    expect(result.answers.fits.noul).toBe(0.42);
    expect(result.model).toBe(JEV);
    expect(result.generationIds).toEqual(['gen_x']);
    // Output tokens are reported even though they are not billed, so `totalTokens` counts both while
    // `cost` reflects input alone.
    expect(result.usage).toEqual({ inputTokens: 272, outputTokens: 34, totalTokens: 306, cost: 0.000011424 });
  });

  it('should raise a fault when the reply did not answer what was declared', async () => {
    const fake = fakeOpenRouterDecisionClient({ answers: { entry: { type: 'choice', choice: 'row-z' } } });
    const request = openRouterDecisionRequest({ state: 'x', questions: { entry: QUESTIONS.entry }, overrides: { model: JEV } });

    await expect(openRouterDecision({ client: fake.client, request })).rejects.toThrow(OpenRouterDecisionAnswerFaultError);
  });

  it('should refuse a chat model before touching the wire', async () => {
    const fake = fakeOpenRouterDecisionClient({ answers: {} });
    const request = openRouterDecisionRequest({ state: 'x', questions: QUESTIONS, overrides: { model: 'openai/gpt-5.1' } });

    await expect(openRouterDecision({ client: fake.client, request })).rejects.toThrow(OpenRouterDecisionDeclarationError);
    expect(fake.callCount).toBe(0);
  });
});
