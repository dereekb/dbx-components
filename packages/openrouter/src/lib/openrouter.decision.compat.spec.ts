/* eslint-disable @typescript-eslint/no-deprecated -- this spec pins the deprecated @dereekb/openrouter decision aliases */
import * as llm from '@dereekb/llm';
import * as llmDecision from '@dereekb/llm/decision';
import {
  type LlmDecisionAnswer,
  type LlmDecisionAnswerFaultError,
  type LlmDecisionAnswerFor,
  type LlmDecisionAnswers,
  type LlmDecisionAnswersRead,
  type LlmDecisionChoiceAnswer,
  type LlmDecisionChoiceOptions,
  type LlmDecisionChoiceQuestion,
  type LlmDecisionChoiceRankingRow,
  type LlmDecisionChoiceRow,
  type LlmDecisionConfidenceBand,
  type LlmDecisionDeclarationError,
  type LlmDecisionEntry,
  type LlmDecisionFault,
  type LlmDecisionFaultKind,
  type LlmDecisionModelId,
  type LlmDecisionNoulAnswer,
  type LlmDecisionNoulMeans,
  type LlmDecisionNoulQuestion,
  type LlmDecisionQuestion,
  type LlmDecisionQuestionId,
  type LlmDecisionQuestions,
  type LlmDecisionQuestionType,
  type LlmDecisionScoreAnswer,
  type LlmDecisionScoreLevels,
  type LlmDecisionScoreQuestion,
  type LlmDecisionState,
  type LlmDecisionStructuredCriterion,
  type LlmDecisionStructuredInstructions,
  type LlmDecisionStructuredLevel,
  type LlmDecisionWireQuestion,
  type LlmStorableDecisionState,
  type MapLlmDecisionChoiceRowsConfig,
  type ReadLlmDecisionAnswersConfig,
  llmChoiceQuestion
} from '@dereekb/llm/decision';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as decisionEntry from '../decision';
import * as rootEntry from '../index';
import { fakeOpenRouterDecisionClient } from '../test/openrouter.fake';
import {
  type MapOpenRouterDecisionChoiceRowsConfig,
  type OpenRouterDecisionAnswer,
  type OpenRouterDecisionAnswerFaultError,
  type OpenRouterDecisionAnswerFor,
  type OpenRouterDecisionAnswers,
  type OpenRouterDecisionAnswersRead,
  type OpenRouterDecisionChoiceAnswer,
  type OpenRouterDecisionChoiceOptions,
  type OpenRouterDecisionChoiceQuestion,
  type OpenRouterDecisionChoiceRankingRow,
  type OpenRouterDecisionChoiceRow,
  type OpenRouterDecisionConfidenceBand,
  type OpenRouterDecisionDeclarationError,
  type OpenRouterDecisionEntry,
  type OpenRouterDecisionFault,
  type OpenRouterDecisionFaultKind,
  type OpenRouterDecisionNoulAnswer,
  type OpenRouterDecisionNoulMeans,
  type OpenRouterDecisionNoulQuestion,
  type OpenRouterDecisionQuestion,
  type OpenRouterDecisionQuestionId,
  type OpenRouterDecisionQuestions,
  type OpenRouterDecisionQuestionType,
  type OpenRouterDecisionScoreAnswer,
  type OpenRouterDecisionScoreLevels,
  type OpenRouterDecisionScoreQuestion,
  type OpenRouterDecisionState,
  type OpenRouterDecisionStructuredCriterion,
  type OpenRouterDecisionStructuredInstructions,
  type OpenRouterDecisionStructuredLevel,
  type OpenRouterDecisionWireQuestion,
  type OpenRouterStorableDecisionState,
  type OpenRouterSystemOneModelId,
  type ReadOpenRouterDecisionAnswersConfig,
  OpenRouterDecisionAnswerFaultError as AliasAnswerFaultError,
  OpenRouterDecisionDeclarationError as AliasDeclarationError,
  openRouterNoulQuestion
} from '../decision';
import * as compat from './openrouter.decision.compat';
import { openRouterDecisionRequest } from './openrouter.decision';
import { openRouterDecision } from './openrouter.decision.call';
import { OPENROUTER_JEV_1_13_MODEL_ID } from './openrouter.type';

/**
 * Every value alias in `openrouter.decision.compat.ts`: the deprecated name, and the `@dereekb/llm` name it is.
 */
const VALUE_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['OPENROUTER_DECISION_CONFIDENCE_HIGH', 'LLM_DECISION_CONFIDENCE_HIGH'],
  ['OPENROUTER_DECISION_CONFIDENCE_MEDIUM', 'LLM_DECISION_CONFIDENCE_MEDIUM'],
  ['OPENROUTER_DECISION_CHOICE_OPTIONS_MAX', 'LLM_DECISION_CHOICE_OPTIONS_MAX'],
  ['OPENROUTER_DECISION_SCORE_LEVELS_MIN', 'LLM_DECISION_SCORE_LEVELS_MIN'],
  ['OPENROUTER_DECISION_SCORE_LEVELS_MAX', 'LLM_DECISION_SCORE_LEVELS_MAX'],
  ['OPENROUTER_DECISION_DISTRIBUTION_SUM_TOLERANCE', 'LLM_DECISION_DISTRIBUTION_SUM_TOLERANCE'],
  ['OPENROUTER_SYSTEM_ONE_MODEL_NAMESPACE', 'LLM_DECISION_MODEL_NAMESPACE'],
  ['isBlankOpenRouterDecisionEntry', 'isBlankLlmDecisionEntry'],
  ['asOpenRouterDecisionConfidenceBand', 'asLlmDecisionConfidenceBand'],
  ['mapOpenRouterDecisionChoiceRows', 'mapLlmDecisionChoiceRows'],
  ['validateOpenRouterDecisionQuestions', 'validateLlmDecisionQuestions'],
  ['readOpenRouterDecisionAnswers', 'readLlmDecisionAnswers'],
  ['openRouterDecisionChoiceOptionNames', 'llmDecisionChoiceOptionNames'],
  ['openRouterDecisionChoiceRanking', 'llmDecisionChoiceRanking'],
  ['openRouterDecisionStatePaths', 'llmDecisionStatePaths'],
  ['openRouterDecisionWireQuestion', 'llmDecisionWireQuestion'],
  ['openRouterChoiceQuestion', 'llmChoiceQuestion'],
  ['openRouterScoreQuestion', 'llmScoreQuestion'],
  ['openRouterNoulQuestion', 'llmNoulQuestion'],
  ['isOpenRouterSystemOneModelId', 'isLlmDecisionModelId'],
  ['OpenRouterDecisionAnswerFaultError', 'LlmDecisionAnswerFaultError'],
  ['OpenRouterDecisionDeclarationError', 'LlmDecisionDeclarationError']
];

const QUESTIONS = {
  pick: llmChoiceQuestion('Which one does `phrase` name?', { a: 'the first', b: 'the second' })
} satisfies LlmDecisionQuestions;

describe('the deprecated @dereekb/openrouter decision aliases', () => {
  it('should cover every value the compat module exports', () => {
    expect(VALUE_ALIASES.map(([old]) => old).sort()).toEqual(Object.keys(compat).sort());
  });

  it.each(VALUE_ALIASES)('should export %s from both entries as the same value as %s', (old, name) => {
    const replacement = (llmDecision as Record<string, unknown>)[name];

    expect(replacement).toBeDefined();
    expect((decisionEntry as Record<string, unknown>)[old]).toBe(replacement);
    expect((rootEntry as Record<string, unknown>)[old]).toBe(replacement);
  });

  it('should alias every type to its @dereekb/llm type', () => {
    expectTypeOf<OpenRouterDecisionAnswerFaultError>().toEqualTypeOf<LlmDecisionAnswerFaultError>();
    expectTypeOf<OpenRouterDecisionDeclarationError>().toEqualTypeOf<LlmDecisionDeclarationError>();
    expectTypeOf<OpenRouterDecisionQuestionId>().toEqualTypeOf<LlmDecisionQuestionId>();
    expectTypeOf<OpenRouterDecisionQuestionType>().toEqualTypeOf<LlmDecisionQuestionType>();
    expectTypeOf<OpenRouterDecisionEntry>().toEqualTypeOf<LlmDecisionEntry>();
    expectTypeOf<OpenRouterDecisionStructuredInstructions>().toEqualTypeOf<LlmDecisionStructuredInstructions>();
    expectTypeOf<OpenRouterDecisionStructuredCriterion>().toEqualTypeOf<LlmDecisionStructuredCriterion>();
    expectTypeOf<OpenRouterDecisionStructuredLevel>().toEqualTypeOf<LlmDecisionStructuredLevel>();
    expectTypeOf<OpenRouterDecisionNoulMeans>().toEqualTypeOf<LlmDecisionNoulMeans>();
    expectTypeOf<OpenRouterDecisionScoreLevels>().toEqualTypeOf<LlmDecisionScoreLevels>();
    expectTypeOf<OpenRouterDecisionScoreQuestion>().toEqualTypeOf<LlmDecisionScoreQuestion>();
    expectTypeOf<OpenRouterDecisionNoulQuestion>().toEqualTypeOf<LlmDecisionNoulQuestion>();
    expectTypeOf<OpenRouterDecisionQuestions>().toEqualTypeOf<LlmDecisionQuestions>();
    expectTypeOf<OpenRouterDecisionState>().toEqualTypeOf<LlmDecisionState>();
    expectTypeOf<OpenRouterDecisionScoreAnswer>().toEqualTypeOf<LlmDecisionScoreAnswer>();
    expectTypeOf<OpenRouterDecisionNoulAnswer>().toEqualTypeOf<LlmDecisionNoulAnswer>();
    expectTypeOf<OpenRouterDecisionConfidenceBand>().toEqualTypeOf<LlmDecisionConfidenceBand>();
    expectTypeOf<OpenRouterDecisionWireQuestion>().toEqualTypeOf<LlmDecisionWireQuestion>();
    expectTypeOf<OpenRouterDecisionFaultKind>().toEqualTypeOf<LlmDecisionFaultKind>();
    expectTypeOf<OpenRouterDecisionFault>().toEqualTypeOf<LlmDecisionFault>();
    expectTypeOf<OpenRouterDecisionChoiceOptions<'a' | 'b'>>().toEqualTypeOf<LlmDecisionChoiceOptions<'a' | 'b'>>();
    expectTypeOf<OpenRouterDecisionChoiceQuestion<'a' | 'b'>>().toEqualTypeOf<LlmDecisionChoiceQuestion<'a' | 'b'>>();
    expectTypeOf<OpenRouterDecisionQuestion<'a' | 'b'>>().toEqualTypeOf<LlmDecisionQuestion<'a' | 'b'>>();
    expectTypeOf<OpenRouterDecisionChoiceAnswer<'a' | 'b'>>().toEqualTypeOf<LlmDecisionChoiceAnswer<'a' | 'b'>>();
    expectTypeOf<OpenRouterDecisionAnswer<'a' | 'b'>>().toEqualTypeOf<LlmDecisionAnswer<'a' | 'b'>>();
    expectTypeOf<OpenRouterDecisionChoiceRankingRow<'a' | 'b'>>().toEqualTypeOf<LlmDecisionChoiceRankingRow<'a' | 'b'>>();
    expectTypeOf<OpenRouterDecisionAnswerFor<LlmDecisionChoiceQuestion<'a' | 'b'>>>().toEqualTypeOf<LlmDecisionAnswerFor<LlmDecisionChoiceQuestion<'a' | 'b'>>>();
    expectTypeOf<OpenRouterDecisionAnswers<typeof QUESTIONS>>().toEqualTypeOf<LlmDecisionAnswers<typeof QUESTIONS>>();
    expectTypeOf<OpenRouterDecisionChoiceRow<number>>().toEqualTypeOf<LlmDecisionChoiceRow<number>>();
    expectTypeOf<MapOpenRouterDecisionChoiceRowsConfig<typeof QUESTIONS, 'pick', number>>().toEqualTypeOf<MapLlmDecisionChoiceRowsConfig<typeof QUESTIONS, 'pick', number>>();
    expectTypeOf<ReadOpenRouterDecisionAnswersConfig<typeof QUESTIONS>>().toEqualTypeOf<ReadLlmDecisionAnswersConfig<typeof QUESTIONS>>();
    expectTypeOf<OpenRouterDecisionAnswersRead<typeof QUESTIONS>>().toEqualTypeOf<LlmDecisionAnswersRead<typeof QUESTIONS>>();
    expectTypeOf<OpenRouterStorableDecisionState>().toEqualTypeOf<LlmStorableDecisionState>();
    expectTypeOf<OpenRouterSystemOneModelId>().toEqualTypeOf<LlmDecisionModelId>();
  });

  it('should serve each moved class as ONE class through all four entries', () => {
    expect(llm.LlmDecisionAnswerFaultError).toBe(llmDecision.LlmDecisionAnswerFaultError);
    expect(rootEntry.OpenRouterDecisionAnswerFaultError).toBe(llmDecision.LlmDecisionAnswerFaultError);
    expect(decisionEntry.OpenRouterDecisionAnswerFaultError).toBe(llmDecision.LlmDecisionAnswerFaultError);
    expect(llm.LlmDecisionDeclarationError).toBe(llmDecision.LlmDecisionDeclarationError);
    expect(rootEntry.OpenRouterDecisionDeclarationError).toBe(llmDecision.LlmDecisionDeclarationError);
    expect(decisionEntry.OpenRouterDecisionDeclarationError).toBe(llmDecision.LlmDecisionDeclarationError);
  });

  it('should reject an off-shape reply with an error that is instanceof both names', async () => {
    const fake = fakeOpenRouterDecisionClient({ answers: { pick: { type: 'choice', choice: 'z' } } });
    const request = openRouterDecisionRequest({ state: 'x', questions: QUESTIONS, overrides: { model: OPENROUTER_JEV_1_13_MODEL_ID } });
    const error = await openRouterDecision({ client: fake.client, request }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(llmDecision.LlmDecisionAnswerFaultError);
    expect(error).toBeInstanceOf(AliasAnswerFaultError);
    expect((error as Error).name).toBe('LlmDecisionAnswerFaultError');
  });

  it('should throw a declaration error from the request builder that is instanceof both names', () => {
    let thrown: unknown;

    try {
      openRouterDecisionRequest({ state: 'x', questions: { blank: openRouterNoulQuestion('') } });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(llmDecision.LlmDecisionDeclarationError);
    expect(thrown).toBeInstanceOf(AliasDeclarationError);
    expect((thrown as Error).name).toBe('LlmDecisionDeclarationError');
    expect((thrown as llmDecision.LlmDecisionDeclarationError).decision).toBeUndefined();
    expect((thrown as Error).message).toContain('This decision cannot be asked as declared:');
  });
});
