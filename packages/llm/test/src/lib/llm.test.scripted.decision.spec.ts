import { describe, expect, it } from 'vitest';
import { llmChoiceQuestion, LlmDecisionAnswerFaultError, type LlmDecisionRequest, llmNoulQuestion } from '@dereekb/llm';
import { makeLlmDecisionChoiceAnswer, makeLlmDecisionNoulAnswer } from './llm.test.decision.answer';
import { makeLlmScriptedDecisionStrategy, LLM_SCRIPTED_DECISION_STRATEGY_ID } from './llm.test.scripted.decision';

describe('makeLlmScriptedDecisionStrategy()', () => {
  const QUESTIONS = { pick: llmChoiceQuestion('which?', { alpha: null, beta: null }), any: llmNoulQuestion('is any right?') };

  it('should answer from the script and capture the whole request for assertion', async () => {
    const requests: LlmDecisionRequest[] = [];
    const strategy = makeLlmScriptedDecisionStrategy({ requests, script: () => ({ pick: makeLlmDecisionChoiceAnswer({ options: ['alpha', 'beta'], choice: 'beta' }), any: makeLlmDecisionNoulAnswer(0.8) }) });
    const result = await strategy.decide({ state: { phrase: 'on the pile' }, questions: QUESTIONS, model: 'scripted' });

    expect(result.answers.pick.choice).toBe('beta');
    expect(result.answers.any.noul).toBe(0.8);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.state).toEqual({ phrase: 'on the pile' });
    expect(Object.keys(requests[0]?.questions ?? {})).toEqual(['pick', 'any']);
  });

  it('should declare the scripted kind, so a run artifact can never read a replay as a billed call', () => {
    const strategy = makeLlmScriptedDecisionStrategy({ script: () => ({}) });
    expect(strategy.kind).toBe(LLM_SCRIPTED_DECISION_STRATEGY_ID);
    expect(strategy.id).toBe(LLM_SCRIPTED_DECISION_STRATEGY_ID);
    expect(makeLlmScriptedDecisionStrategy({ id: 'alpha', script: () => ({}) }).id).toBe('alpha');
  });

  it('should report a ZERO-cost usage: a replayed decision cost nothing, which is a reading rather than "unaccounted"', async () => {
    const strategy = makeLlmScriptedDecisionStrategy({ script: () => ({ pick: makeLlmDecisionChoiceAnswer({ options: ['alpha', 'beta'], choice: 'alpha' }), any: makeLlmDecisionNoulAnswer(0.1) }) });
    const result = await strategy.decide({ state: 'x', questions: QUESTIONS, model: 'scripted' });

    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 });
  });

  it('should refuse a script that under-answers, exactly as a live transport would', async () => {
    const strategy = makeLlmScriptedDecisionStrategy({ script: () => ({ pick: makeLlmDecisionChoiceAnswer({ options: ['alpha', 'beta'], choice: 'alpha' }) }) });

    await expect(strategy.decide({ state: 'x', questions: QUESTIONS, model: 'scripted' })).rejects.toBeInstanceOf(LlmDecisionAnswerFaultError);
  });
});
