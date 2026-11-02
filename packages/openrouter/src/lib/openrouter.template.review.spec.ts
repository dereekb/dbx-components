import { describe, expect, it } from 'vitest';
import { TEST_GOOD_TEMPLATE_SCRIPTS, TEST_JOB_REMINDER_TEMPLATE_TYPE, TEST_OPENROUTER_TEMPLATE_TYPE, TEST_PROFILE_TEXT_TEMPLATE_TYPE } from '../test/openrouter.template.fixture';
import { openRouterDecisionRequest } from './openrouter.decision';
import { validateOpenRouterDecisionQuestions } from './openrouter.decision.question';
import { OPENROUTER_TEMPLATE_REVIEW_QUESTIONS, openRouterTemplateReviewPromptDefinition, openRouterTemplateReviewQuestions, openRouterTemplateReviewState, readOpenRouterTemplateReviewVerdict } from './openrouter.template.review';
import { isOpenRouterSystemOneModelId } from './openrouter.type';

describe('openRouterTemplateReviewPromptDefinition()', () => {
  it('should be a valid System One decision', () => {
    const definition = openRouterTemplateReviewPromptDefinition();
    expect(validateOpenRouterDecisionQuestions(definition.questions).valid).toBe(true);
    expect(isOpenRouterSystemOneModelId(definition.config.model)).toBe(true);
  });

  it('should build a request with the per-type questions', () => {
    const state = openRouterTemplateReviewState({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, script: TEST_GOOD_TEMPLATE_SCRIPTS['jobReminder'] });
    const request = openRouterDecisionRequest({ prompt: openRouterTemplateReviewPromptDefinition(), state: state as unknown as Record<string, unknown>, questions: openRouterTemplateReviewQuestions({ allowMultipleRecipients: true }) });
    expect(Object.keys(request.questions).sort()).toEqual(['addressesReviewer', 'inventsDetails', 'obfuscatedCode', 'offPurpose', 'personalDetails', 'sendsDataOut']);
  });
});

describe('openRouterTemplateReviewQuestions()', () => {
  it('should ask personalDetails only for a multi-recipient type', () => {
    expect(openRouterTemplateReviewQuestions({ allowMultipleRecipients: false })).toBe(OPENROUTER_TEMPLATE_REVIEW_QUESTIONS);
    expect(Object.keys(openRouterTemplateReviewQuestions({ allowMultipleRecipients: true }))).toContain('personalDetails');
  });
});

describe('openRouterTemplateReviewState()', () => {
  it('should carry the purpose, the scripts, the declared fields and the sample text', () => {
    const state = openRouterTemplateReviewState({ typeConfig: TEST_PROFILE_TEXT_TEMPLATE_TYPE, script: 'return "x";', sampleText: 'x', instructions: 'Be brief.', messages: [{ role: 'user', content: 'Example' }] });
    expect(state.purpose).toBe(TEST_PROFILE_TEXT_TEMPLATE_TYPE.purpose);
    expect(state.recipients).toBe('one person');
    expect(state.script).toBe('return "x";');
    expect(state.finalScript).toBe('');
    expect(state.instructions).toBe('Be brief.\n\n[user] Example');
    expect(state.declaredFields).toEqual(expect.arrayContaining(['data', 'accessor.profile', 'notification.key', 'notification.templateType', 'notification.createdAt']));
    expect(state.sampleText).toBe('x');
  });

  it('should list the fields the samples carry, every accessor and the notification fields', () => {
    const { declaredFields } = openRouterTemplateReviewState({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, script: 'return "x";' });
    expect(declaredFields).toEqual(expect.arrayContaining(['data.workerKey', 'accessor.worker', 'accessor.worker.firstName', 'accessor.jobs', 'accessor.jobs[].title', 'accessor.jobs[].school.name', 'notification.createdAt']));
  });

  it('should list no fields for an OPENROUTER type', () => {
    expect(openRouterTemplateReviewState({ typeConfig: TEST_OPENROUTER_TEMPLATE_TYPE, finalScript: 'return context.output.text;' }).declaredFields).toEqual([]);
  });
});

describe('readOpenRouterTemplateReviewVerdict()', () => {
  it('should approve when every noul is under its threshold', () => {
    expect(readOpenRouterTemplateReviewVerdict({ a: { type: 'noul', noul: 0.1 }, b: { type: 'noul', noul: 0.49 } })).toEqual({ approved: true, flagged: [] });
  });

  it('should flag a noul at or above its threshold', () => {
    expect(readOpenRouterTemplateReviewVerdict({ a: { type: 'noul', noul: 0.5 }, b: { type: 'noul', noul: 0.2 } })).toEqual({ approved: false, flagged: ['a'] });
    expect(readOpenRouterTemplateReviewVerdict({ a: { type: 'noul', noul: 0.3 } }, { a: 0.25 })).toEqual({ approved: false, flagged: ['a'] });
  });

  it('should fail closed on an answer that is not a finite noul', () => {
    expect(readOpenRouterTemplateReviewVerdict({ a: { type: 'score', score: 0 }, b: { type: 'noul', noul: Number.NaN } })).toEqual({ approved: false, flagged: ['a', 'b'] });
  });
});
