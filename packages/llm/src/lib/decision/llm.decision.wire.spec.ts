import { describe, expect, it } from 'vitest';
import { type LlmDecisionQuestions, llmChoiceQuestion, llmNoulQuestion, llmScoreQuestion } from './llm.decision.question';
import { type LlmDecisionRequest } from './llm.decision.strategy';
import { llmDecisionRequestBody, llmDecisionWireQuestion } from './llm.decision.wire';

const QUESTIONS = {
  entry: llmChoiceQuestion('Which entry means what `phrase` describes?', { 'row-a': 'the first row', 'row-b': null }),
  heat: llmScoreQuestion('How urgent is `phrase`?', ['idle', 'soon', 'now']),
  fits: llmNoulQuestion('At least one row means what `phrase` describes.', { true: 'one of them fits', false: 'none of them fit' })
} satisfies LlmDecisionQuestions;

describe('llmDecisionWireQuestion()', () => {
  it('should spell an undescribed Choice option as an explicit null', () => {
    // Omitting the key would remove the option from the answer space; null keeps it, undescribed.
    const wire = llmDecisionWireQuestion(QUESTIONS.entry) as { criteria: Record<string, unknown> };
    expect(wire.criteria['row-a']).toBe('the first row');
    expect(wire.criteria['row-b']).toBeNull();
  });

  it('should carry Score levels as an ordered criteria array', () => {
    const wire = llmDecisionWireQuestion(QUESTIONS.heat) as unknown as { criteria: unknown[] };
    expect(wire.criteria).toEqual(['idle', 'soon', 'now']);
  });

  it('should carry a Noul`s two sides as criteria', () => {
    const wire = llmDecisionWireQuestion(QUESTIONS.fits) as { criteria: Record<string, unknown> };
    expect(wire.criteria).toEqual({ true: 'one of them fits', false: 'none of them fit' });
  });

  it('should omit criteria entirely for a Noul with no declared sides', () => {
    // Not an empty object — the key is absent, which is what the wire means by "undefined condition".
    expect('criteria' in llmDecisionWireQuestion(llmNoulQuestion('is it urgent?'))).toBe(false);
  });

  it('should pass a structured entry through by identity', () => {
    // The wire carries declaration guidance VERBATIM, so a normalising copy here would be a silent edit.
    const criterion = { what: 'Charges, invoices, refunds', not_for: 'Order tracking', examples: ['I was charged twice'] };
    const wire = llmDecisionWireQuestion(llmChoiceQuestion('which?', { billing: criterion })) as { criteria: Record<string, unknown> };
    expect(wire.criteria['billing']).toBe(criterion);
  });
});

describe('llmDecisionRequestBody()', () => {
  const REQUEST: LlmDecisionRequest = { model: 'typesafe/jev-1.13', state: { phrase: 'a red door' }, questions: QUESTIONS };

  it('should build exactly the model, state and questions keys, in that order', () => {
    expect(Object.keys(llmDecisionRequestBody(REQUEST))).toEqual(['model', 'state', 'questions']);
  });

  it('should leak no key a host added to the request', () => {
    // ZenMux answers 400 to any body key other than these three.
    const extended = { ...REQUEST, meta: { owner: 'x' }, sessionId: 's', trace: { traceId: 't' }, user: 'u' } as LlmDecisionRequest;
    expect(Object.keys(llmDecisionRequestBody(extended))).toEqual(['model', 'state', 'questions']);
  });

  it('should carry the questions in their wire shape', () => {
    const body = llmDecisionRequestBody({ ...REQUEST, questions: { ...QUESTIONS, open: llmNoulQuestion('is it urgent?') } });
    expect((body.questions['entry'] as { criteria: Record<string, unknown> }).criteria['row-b']).toBeNull();
    expect('criteria' in body.questions['open']).toBe(false);
    expect(body.questions['heat']).toEqual(llmDecisionWireQuestion(QUESTIONS.heat));
  });

  it('should serialize a small request to the pinned bytes', () => {
    const body = llmDecisionRequestBody({ model: 'typesafe/jev-1.13', state: { phrase: 'a b' }, questions: { fits: llmNoulQuestion('`phrase` fits.') } });
    expect(JSON.stringify(body)).toBe('{"model":"typesafe/jev-1.13","state":{"phrase":"a b"},"questions":{"fits":{"type":"noul","instructions":"`phrase` fits."}}}');
  });
});
