import { describe, expect, it } from 'vitest';
import { readLlmDecisionAnswers } from './llm.decision.answer';
import { makeLlmDecisionChoiceAnswer, makeLlmDecisionNoulAnswer, makeLlmDecisionScoreAnswer } from './llm.decision.answer.builder';
import { llmChoiceQuestion, llmNoulQuestion, llmScoreQuestion } from './llm.decision.question';

const OPTIONS = ['alpha', 'beta', 'gamma', 'delta'] as const;

describe('the decision answer builders', () => {
  it('should build a Choice the reader accepts, with the named option winning', () => {
    const question = llmChoiceQuestion('which?', { alpha: null, beta: null, gamma: null, delta: null });
    const answer = makeLlmDecisionChoiceAnswer({ options: [...OPTIONS], choice: 'gamma', confidence: 0.7 });

    expect(answer.choice).toBe('gamma');
    expect(answer.probabilities?.gamma).toBe(0.7);
    expect(Object.values<number>(answer.probabilities ?? {}).reduce((total, value) => total + value, 0)).toBeCloseTo(1, 10);
    expect(readLlmDecisionAnswers({ questions: { q: question }, raw: { q: answer } }).faults).toBeUndefined();
  });

  it('should give a single-option Choice the whole mass: there was nothing to be unsure between', () => {
    expect(makeLlmDecisionChoiceAnswer({ options: ['only'], choice: 'only' }).probabilities?.only).toBe(1);
  });

  it('should build a Score the reader accepts, with the mass on the nearest level', () => {
    const answer = makeLlmDecisionScoreAnswer({ levels: ['cold', 'warm', 'hot'], score: 1.6 });

    expect(answer.score).toBe(1.6);
    expect(answer.probabilities?.['2']).toBe(0.8);
    expect(answer.legend?.['1']).toBe('warm');
    expect(readLlmDecisionAnswers({ questions: { q: llmScoreQuestion('how hot?', ['cold', 'warm', 'hot']) }, raw: { q: answer } }).faults).toBeUndefined();
  });

  it('should build a Noul the reader accepts', () => {
    expect(readLlmDecisionAnswers({ questions: { q: llmNoulQuestion('so?') }, raw: { q: makeLlmDecisionNoulAnswer(0.3) } }).faults).toBeUndefined();
  });
});
