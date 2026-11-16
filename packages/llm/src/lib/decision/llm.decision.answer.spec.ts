import { describe, expect, it } from 'vitest';
import { LlmDecisionAnswerFaultError, readLlmDecisionAnswers } from './llm.decision.answer';
import { type LlmDecisionAnswer, type LlmDecisionQuestions, llmChoiceQuestion, llmNoulQuestion, llmScoreQuestion } from './llm.decision.question';

const QUESTIONS = {
  entry: llmChoiceQuestion('Which entry means what `phrase` describes?', { 'row-a': 'the first row', 'row-b': null }),
  heat: llmScoreQuestion('How urgent is `phrase`?', ['idle', 'soon', 'now']),
  fits: llmNoulQuestion('At least one row means what `phrase` describes.', { true: 'one of them fits', false: 'none of them fit' })
} satisfies LlmDecisionQuestions;

describe('readLlmDecisionAnswers()', () => {
  it('should pass a well formed reply through', () => {
    const read = readLlmDecisionAnswers({ questions: QUESTIONS, raw: { entry: { type: 'choice', choice: 'row-a' }, heat: { type: 'score', score: 2 }, fits: { type: 'noul', noul: 0.9 } } });
    expect(read.faults).toBeUndefined();
    expect(read.answers?.fits.noul).toBe(0.9);
  });

  it('should fault a missing answer', () => {
    const read = readLlmDecisionAnswers({ questions: { fits: QUESTIONS.fits }, raw: {} });
    expect(read.faults?.[0].kind).toBe('answer-missing');
  });

  it('should fault an answer of the wrong type', () => {
    const read = readLlmDecisionAnswers({ questions: { fits: QUESTIONS.fits }, raw: { fits: { type: 'score', score: 1 } as LlmDecisionAnswer } });
    expect(read.faults?.[0].kind).toBe('answer-mistyped');
  });

  it('should fault a choice outside the declared options', () => {
    const read = readLlmDecisionAnswers({ questions: { entry: QUESTIONS.entry }, raw: { entry: { type: 'choice', choice: 'row-z' } } });
    expect(read.faults?.[0].kind).toBe('choice-off-option');
  });

  it('should fault a distribution over undeclared options', () => {
    const read = readLlmDecisionAnswers({ questions: { entry: QUESTIONS.entry }, raw: { entry: { type: 'choice', choice: 'row-a', probabilities: { 'row-a': 0.5, 'row-z': 0.5 } } } });
    expect(read.faults?.some((x) => x.kind === 'choice-off-option')).toBe(true);
  });

  it('should fault a distribution that does not sum to 1', () => {
    const read = readLlmDecisionAnswers({ questions: { entry: QUESTIONS.entry }, raw: { entry: { type: 'choice', choice: 'row-a', probabilities: { 'row-a': 0.2, 'row-b': 0.2 } } } });
    expect(read.faults?.[0].kind).toBe('value-out-of-range');
  });

  it('should tolerate float noise in a distribution', () => {
    const read = readLlmDecisionAnswers({ questions: { entry: QUESTIONS.entry }, raw: { entry: { type: 'choice', choice: 'row-a', probabilities: { 'row-a': 0.7000001, 'row-b': 0.2999998 } } } });
    expect(read.faults).toBeUndefined();
  });

  it('should check nothing about an absent distribution', () => {
    // Only choice/score/noul are guaranteed on the wire; the rest absent is a real reply.
    const read = readLlmDecisionAnswers({ questions: { entry: QUESTIONS.entry }, raw: { entry: { type: 'choice', choice: 'row-a' } } });
    expect(read.faults).toBeUndefined();
  });

  it('should fault a score outside the declared levels', () => {
    const read = readLlmDecisionAnswers({ questions: { heat: QUESTIONS.heat }, raw: { heat: { type: 'score', score: 3 } } });
    expect(read.faults?.[0].kind).toBe('value-out-of-range');
  });

  it('should fault a noul outside 0..1', () => {
    const read = readLlmDecisionAnswers({ questions: { fits: QUESTIONS.fits }, raw: { fits: { type: 'noul', noul: 1.2 } } });
    expect(read.faults?.[0].kind).toBe('value-out-of-range');
  });

  it('should collect every fault rather than only the first', () => {
    const read = readLlmDecisionAnswers({ questions: QUESTIONS, raw: {} });
    expect(read.faults).toHaveLength(3);
  });
});

/**
 * The contract a decision strategy relies on: every `LlmDecisionFaultKind` is reachable through
 * `readLlmDecisionAnswers`, and it names EVERY fault it found rather than the first (a caller correcting a
 * declaration wants the whole list). Also pins the two tolerances that are NOT faults: an absent distribution and an
 * absent confidence are well-formed replies, because the wire types them optional.
 */

const CONTRACT_QUESTIONS = {
  pick: llmChoiceQuestion('which one?', { alpha: 'the first', beta: 'the second' }),
  heat: llmScoreQuestion('how hot?', ['cold', 'warm', 'hot']),
  sure: llmNoulQuestion('is it so?')
};

/**
 * A sound answer set for {@link CONTRACT_QUESTIONS} — the baseline each case perturbs one field of.
 *
 * @returns The raw answers.
 */
function soundAnswers(): Record<string, LlmDecisionAnswer> {
  return {
    pick: { type: 'choice', choice: 'alpha', probabilities: { alpha: 0.8, beta: 0.2 }, confidence: 0.8 },
    heat: { type: 'score', score: 1.4, legend: { '0': 'cold', '1': 'warm', '2': 'hot' }, probabilities: { '0': 0.2, '1': 0.6, '2': 0.2 }, confidence: 0.6 },
    sure: { type: 'noul', noul: 0.42 }
  };
}

describe('readLlmDecisionAnswers() — the contract a decision strategy relies on', () => {
  it('reads a sound reply as the typed answer set', () => {
    const read = readLlmDecisionAnswers({ questions: CONTRACT_QUESTIONS, raw: soundAnswers() });

    expect(read.faults).toBeUndefined();
    expect(read.answers?.pick.choice).toBe('alpha');
    expect(read.answers?.heat.score).toBe(1.4);
    expect(read.answers?.sure.noul).toBe(0.42);
  });

  it('faults `answer-missing` for a declared question with no answer', () => {
    const raw = soundAnswers();
    delete raw['heat'];

    expect(readLlmDecisionAnswers({ questions: CONTRACT_QUESTIONS, raw }).faults).toEqual([expect.objectContaining({ kind: 'answer-missing', question: 'heat' })]);
  });

  it('faults `answer-mistyped` when the primitive disagrees with the question', () => {
    const raw = { ...soundAnswers(), sure: { type: 'score', score: 1 } as LlmDecisionAnswer };
    const faults = readLlmDecisionAnswers({ questions: CONTRACT_QUESTIONS, raw }).faults ?? [];

    expect(faults.map((fault) => fault.kind)).toEqual(['answer-mistyped']);
    expect(faults[0]?.question).toBe('sure');
  });

  it('faults `choice-off-option` for an undeclared winner', () => {
    const raw = { ...soundAnswers(), pick: { type: 'choice', choice: 'gamma', probabilities: { alpha: 0.5, beta: 0.5 }, confidence: 0.5 } as LlmDecisionAnswer };
    const faults = readLlmDecisionAnswers({ questions: CONTRACT_QUESTIONS, raw }).faults ?? [];

    expect(faults.map((fault) => fault.kind)).toEqual(['choice-off-option']);
    expect(faults[0]?.detail).toContain('gamma');
  });

  it('faults `choice-off-option` for a distribution over undeclared options', () => {
    const raw = { ...soundAnswers(), pick: { type: 'choice', choice: 'alpha', probabilities: { alpha: 0.5, gamma: 0.5 }, confidence: 0.5 } as LlmDecisionAnswer };
    const faults = readLlmDecisionAnswers({ questions: CONTRACT_QUESTIONS, raw }).faults ?? [];

    expect(faults.map((fault) => fault.kind)).toEqual(['choice-off-option']);
    expect(faults[0]?.detail).toContain('gamma');
  });

  it('faults `value-out-of-range` for a score past the declared levels and a noul past 0..1', () => {
    const raw = { ...soundAnswers(), heat: { type: 'score', score: 3.5 } as LlmDecisionAnswer, sure: { type: 'noul', noul: 1.4 } as LlmDecisionAnswer };
    const faults = readLlmDecisionAnswers({ questions: CONTRACT_QUESTIONS, raw }).faults ?? [];

    expect(faults.map((fault) => `${fault.question}:${fault.kind}`)).toEqual(['heat:value-out-of-range', 'sure:value-out-of-range']);
  });

  it('names EVERY fault it found, not the first', () => {
    const faults =
      readLlmDecisionAnswers({
        questions: CONTRACT_QUESTIONS,
        raw: { pick: { type: 'choice', choice: 'gamma', probabilities: { alpha: 1 } } as LlmDecisionAnswer, sure: { type: 'noul', noul: 9 } as LlmDecisionAnswer }
      }).faults ?? [];

    expect(faults.map((fault) => `${fault.question}:${fault.kind}`)).toEqual(['pick:choice-off-option', 'heat:answer-missing', 'sure:value-out-of-range']);
  });

  it('accepts an answer with NO distribution and NO confidence: the wire types them optional', () => {
    const read = readLlmDecisionAnswers({ questions: { pick: CONTRACT_QUESTIONS.pick }, raw: { pick: { type: 'choice', choice: 'beta' } } });

    expect(read.faults).toBeUndefined();
    expect(read.answers?.pick.choice).toBe('beta');
  });

  it('still faults a distribution that is PRESENT and does not sum to 1', () => {
    const faults = readLlmDecisionAnswers({ questions: { pick: CONTRACT_QUESTIONS.pick }, raw: { pick: { type: 'choice', choice: 'alpha', probabilities: { alpha: 0.2, beta: 0.2 } } } }).faults ?? [];

    expect(faults.map((fault) => fault.kind)).toEqual(['value-out-of-range']);
  });
});

describe('LlmDecisionAnswerFaultError', () => {
  it('should carry its faults and describe each in its message', () => {
    const error = new LlmDecisionAnswerFaultError([
      { kind: 'answer-missing', question: 'a', detail: 'no answer was returned' },
      { kind: 'value-out-of-range', question: 'b', detail: 'the noul 2 is outside 0..1' }
    ]);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LlmDecisionAnswerFaultError');
    expect(error.faults).toHaveLength(2);
    expect(error.message).toBe('The decision reply did not answer its declared questions: a (answer-missing): no answer was returned; b (value-out-of-range): the noul 2 is outside 0..1');
  });
});
