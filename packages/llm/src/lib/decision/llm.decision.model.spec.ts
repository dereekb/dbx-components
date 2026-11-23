import { describe, expect, it } from 'vitest';
import { LLM_DECISION_MODEL_NAMESPACE, isLlmDecisionModelId, llmDecisionModelIssue } from './llm.decision.model';

describe('isLlmDecisionModelId()', () => {
  it.each(['typesafe/jev-1.13', 'jev-1.13', 'jev-latest', 'jev', '  TypeSafe/Jev-1.13 '])('should recognise %j as a decision model', (model) => {
    expect(isLlmDecisionModelId(model)).toBe(true);
  });

  it.each(['openai/gpt-5.1', 'jevons/x', 'jevx', '', null, undefined])('should not recognise %j as a decision model', (model) => {
    expect(isLlmDecisionModelId(model)).toBe(false);
  });

  it('should namespace decision models under typesafe', () => {
    expect(LLM_DECISION_MODEL_NAMESPACE).toBe('typesafe');
  });
});

describe('llmDecisionModelIssue()', () => {
  it('should raise no issue for an absent model', () => {
    expect(llmDecisionModelIssue(undefined)).toBeUndefined();
    expect(llmDecisionModelIssue(null)).toBeUndefined();
  });

  it.each(['typesafe/jev-1.14', 'jev-latest'])('should raise no issue for the decision model %j', (model) => {
    expect(llmDecisionModelIssue(model)).toBeUndefined();
  });

  it('should refuse a completion model', () => {
    expect(llmDecisionModelIssue('openai/gpt-5.1')).toBe("the decision model 'openai/gpt-5.1' is not a decision model (a 'typesafe/…' Jev slug): a decision is served by a gateway's decision route, which refuses a completion model's slug");
  });
});
