/**
 * Deprecated `@dereekb/openrouter` names for the decision vocabulary.
 *
 * The protocol-level decision vocabulary — questions and answers, the declaration validator and its error, the wire
 * question, the answer reader and its fault error, and the decision-model guard — moved to `@dereekb/llm/decision`
 * under neutral `Llm…` names, so a transport that is not OpenRouter shares it. JSON shapes are unchanged: a stored
 * question map, state or answer set reads the same through either name.
 *
 * Every name below is the SAME value, class or type as its `@dereekb/llm` replacement — a class alias is the same
 * class, so `instanceof` holds whichever name was imported. These names will be removed in a future major release.
 */
import {
  asLlmDecisionConfidenceBand,
  isBlankLlmDecisionEntry,
  isLlmDecisionModelId,
  LLM_DECISION_CHOICE_OPTIONS_MAX,
  LLM_DECISION_CONFIDENCE_HIGH,
  LLM_DECISION_CONFIDENCE_MEDIUM,
  LLM_DECISION_DISTRIBUTION_SUM_TOLERANCE,
  LLM_DECISION_MODEL_NAMESPACE,
  LLM_DECISION_SCORE_LEVELS_MAX,
  LLM_DECISION_SCORE_LEVELS_MIN,
  llmChoiceQuestion,
  type LlmDecisionAnswer,
  LlmDecisionAnswerFaultError,
  type LlmDecisionAnswerFor,
  type LlmDecisionAnswers,
  type LlmDecisionAnswersRead,
  type LlmDecisionChoiceAnswer,
  llmDecisionChoiceOptionNames,
  type LlmDecisionChoiceOptions,
  type LlmDecisionChoiceQuestion,
  llmDecisionChoiceRanking,
  type LlmDecisionChoiceRankingRow,
  type LlmDecisionChoiceRow,
  type LlmDecisionConfidenceBand,
  LlmDecisionDeclarationError,
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
  llmDecisionStatePaths,
  type LlmDecisionStructuredCriterion,
  type LlmDecisionStructuredInstructions,
  type LlmDecisionStructuredLevel,
  llmDecisionWireQuestion,
  type LlmDecisionWireQuestion,
  llmNoulQuestion,
  llmScoreQuestion,
  type LlmStorableDecisionState,
  mapLlmDecisionChoiceRows,
  type MapLlmDecisionChoiceRowsConfig,
  readLlmDecisionAnswers,
  type ReadLlmDecisionAnswersConfig,
  validateLlmDecisionQuestions
} from '@dereekb/llm';

// COMPAT: Deprecated aliases
/**
 * @deprecated Use {@link LLM_DECISION_CONFIDENCE_HIGH} from `@dereekb/llm/decision`; this is the same value.
 */
export const OPENROUTER_DECISION_CONFIDENCE_HIGH = LLM_DECISION_CONFIDENCE_HIGH;
/**
 * @deprecated Use {@link LLM_DECISION_CONFIDENCE_MEDIUM} from `@dereekb/llm/decision`; this is the same value.
 */
export const OPENROUTER_DECISION_CONFIDENCE_MEDIUM = LLM_DECISION_CONFIDENCE_MEDIUM;
/**
 * @deprecated Use {@link LLM_DECISION_CHOICE_OPTIONS_MAX} from `@dereekb/llm/decision`; this is the same value.
 */
export const OPENROUTER_DECISION_CHOICE_OPTIONS_MAX = LLM_DECISION_CHOICE_OPTIONS_MAX;
/**
 * @deprecated Use {@link LLM_DECISION_SCORE_LEVELS_MIN} from `@dereekb/llm/decision`; this is the same value.
 */
export const OPENROUTER_DECISION_SCORE_LEVELS_MIN = LLM_DECISION_SCORE_LEVELS_MIN;
/**
 * @deprecated Use {@link LLM_DECISION_SCORE_LEVELS_MAX} from `@dereekb/llm/decision`; this is the same value.
 */
export const OPENROUTER_DECISION_SCORE_LEVELS_MAX = LLM_DECISION_SCORE_LEVELS_MAX;
/**
 * @deprecated Use {@link LLM_DECISION_DISTRIBUTION_SUM_TOLERANCE} from `@dereekb/llm/decision`; this is the same value.
 */
export const OPENROUTER_DECISION_DISTRIBUTION_SUM_TOLERANCE = LLM_DECISION_DISTRIBUTION_SUM_TOLERANCE;
/**
 * @deprecated Use {@link LLM_DECISION_MODEL_NAMESPACE} from `@dereekb/llm/decision`; this is the same value.
 */
export const OPENROUTER_SYSTEM_ONE_MODEL_NAMESPACE = LLM_DECISION_MODEL_NAMESPACE;
/**
 * @deprecated Use {@link isBlankLlmDecisionEntry} from `@dereekb/llm/decision`; this is the same function.
 */
export const isBlankOpenRouterDecisionEntry = isBlankLlmDecisionEntry;
/**
 * @deprecated Use {@link asLlmDecisionConfidenceBand} from `@dereekb/llm/decision`; this is the same function.
 */
export const asOpenRouterDecisionConfidenceBand = asLlmDecisionConfidenceBand;
/**
 * @deprecated Use {@link mapLlmDecisionChoiceRows} from `@dereekb/llm/decision`; this is the same function.
 */
export const mapOpenRouterDecisionChoiceRows = mapLlmDecisionChoiceRows;
/**
 * @deprecated Use {@link validateLlmDecisionQuestions} from `@dereekb/llm/decision`; this is the same function.
 */
export const validateOpenRouterDecisionQuestions = validateLlmDecisionQuestions;
/**
 * @deprecated Use {@link readLlmDecisionAnswers} from `@dereekb/llm/decision`; this is the same function.
 */
export const readOpenRouterDecisionAnswers = readLlmDecisionAnswers;
/**
 * @deprecated Use {@link llmDecisionChoiceOptionNames} from `@dereekb/llm/decision`; this is the same function.
 */
export const openRouterDecisionChoiceOptionNames = llmDecisionChoiceOptionNames;
/**
 * @deprecated Use {@link llmDecisionChoiceRanking} from `@dereekb/llm/decision`; this is the same function.
 */
export const openRouterDecisionChoiceRanking = llmDecisionChoiceRanking;
/**
 * @deprecated Use {@link llmDecisionStatePaths} from `@dereekb/llm/decision`; this is the same function.
 */
export const openRouterDecisionStatePaths = llmDecisionStatePaths;
/**
 * @deprecated Use {@link llmDecisionWireQuestion} from `@dereekb/llm/decision`; this is the same function.
 */
export const openRouterDecisionWireQuestion = llmDecisionWireQuestion;
/**
 * @deprecated Use {@link llmChoiceQuestion} from `@dereekb/llm/decision`; this is the same function.
 */
export const openRouterChoiceQuestion = llmChoiceQuestion;
/**
 * @deprecated Use {@link llmScoreQuestion} from `@dereekb/llm/decision`; this is the same function.
 */
export const openRouterScoreQuestion = llmScoreQuestion;
/**
 * @deprecated Use {@link llmNoulQuestion} from `@dereekb/llm/decision`; this is the same function.
 */
export const openRouterNoulQuestion = llmNoulQuestion;
/**
 * @deprecated Use {@link isLlmDecisionModelId} from `@dereekb/llm/decision`; this is the same function.
 */
export const isOpenRouterSystemOneModelId = isLlmDecisionModelId;
/**
 * @deprecated Use {@link LlmDecisionAnswerFaultError} from `@dereekb/llm/decision`; this is the same class, so `instanceof` holds either way.
 */
export const OpenRouterDecisionAnswerFaultError = LlmDecisionAnswerFaultError;
/**
 * @deprecated Use {@link LlmDecisionAnswerFaultError} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionAnswerFaultError = LlmDecisionAnswerFaultError;
/**
 * @deprecated Use {@link LlmDecisionDeclarationError} from `@dereekb/llm/decision`; this is the same class, so `instanceof` holds either way.
 */
export const OpenRouterDecisionDeclarationError = LlmDecisionDeclarationError;
/**
 * @deprecated Use {@link LlmDecisionDeclarationError} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionDeclarationError = LlmDecisionDeclarationError;
/**
 * @deprecated Use {@link LlmDecisionQuestionId} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionQuestionId = LlmDecisionQuestionId;
/**
 * @deprecated Use {@link LlmDecisionQuestionType} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionQuestionType = LlmDecisionQuestionType;
/**
 * @deprecated Use {@link LlmDecisionEntry} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionEntry = LlmDecisionEntry;
/**
 * @deprecated Use {@link LlmDecisionStructuredInstructions} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionStructuredInstructions = LlmDecisionStructuredInstructions;
/**
 * @deprecated Use {@link LlmDecisionStructuredCriterion} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionStructuredCriterion = LlmDecisionStructuredCriterion;
/**
 * @deprecated Use {@link LlmDecisionStructuredLevel} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionStructuredLevel = LlmDecisionStructuredLevel;
/**
 * @deprecated Use {@link LlmDecisionNoulMeans} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionNoulMeans = LlmDecisionNoulMeans;
/**
 * @deprecated Use {@link LlmDecisionScoreLevels} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionScoreLevels = LlmDecisionScoreLevels;
/**
 * @deprecated Use {@link LlmDecisionScoreQuestion} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionScoreQuestion = LlmDecisionScoreQuestion;
/**
 * @deprecated Use {@link LlmDecisionNoulQuestion} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionNoulQuestion = LlmDecisionNoulQuestion;
/**
 * @deprecated Use {@link LlmDecisionQuestions} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionQuestions = LlmDecisionQuestions;
/**
 * @deprecated Use {@link LlmDecisionState} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionState = LlmDecisionState;
/**
 * @deprecated Use {@link LlmDecisionScoreAnswer} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionScoreAnswer = LlmDecisionScoreAnswer;
/**
 * @deprecated Use {@link LlmDecisionNoulAnswer} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionNoulAnswer = LlmDecisionNoulAnswer;
/**
 * @deprecated Use {@link LlmDecisionConfidenceBand} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionConfidenceBand = LlmDecisionConfidenceBand;
/**
 * @deprecated Use {@link LlmDecisionWireQuestion} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionWireQuestion = LlmDecisionWireQuestion;
/**
 * @deprecated Use {@link LlmDecisionFaultKind} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionFaultKind = LlmDecisionFaultKind;
/**
 * @deprecated Use {@link LlmDecisionFault} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionFault = LlmDecisionFault;
/**
 * @deprecated Use {@link LlmDecisionChoiceOptions} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionChoiceOptions<O extends string = string> = LlmDecisionChoiceOptions<O>;
/**
 * @deprecated Use {@link LlmDecisionChoiceQuestion} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionChoiceQuestion<O extends string = string> = LlmDecisionChoiceQuestion<O>;
/**
 * @deprecated Use {@link LlmDecisionQuestion} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionQuestion<O extends string = string> = LlmDecisionQuestion<O>;
/**
 * @deprecated Use {@link LlmDecisionChoiceAnswer} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionChoiceAnswer<O extends string = string> = LlmDecisionChoiceAnswer<O>;
/**
 * @deprecated Use {@link LlmDecisionAnswer} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionAnswer<O extends string = string> = LlmDecisionAnswer<O>;
/**
 * @deprecated Use {@link LlmDecisionChoiceRankingRow} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionChoiceRankingRow<O extends string = string> = LlmDecisionChoiceRankingRow<O>;
/**
 * @deprecated Use {@link LlmDecisionAnswerFor} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionAnswerFor<Q extends LlmDecisionQuestion> = LlmDecisionAnswerFor<Q>;
/**
 * @deprecated Use {@link LlmDecisionAnswers} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionAnswers<Q extends LlmDecisionQuestions = LlmDecisionQuestions> = LlmDecisionAnswers<Q>;
/**
 * @deprecated Use {@link LlmDecisionChoiceRow} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionChoiceRow<R> = LlmDecisionChoiceRow<R>;
/**
 * @deprecated Use {@link MapLlmDecisionChoiceRowsConfig} from `@dereekb/llm/decision`.
 */
export type MapOpenRouterDecisionChoiceRowsConfig<Q extends LlmDecisionQuestions, K extends keyof Q & string, R> = MapLlmDecisionChoiceRowsConfig<Q, K, R>;
/**
 * @deprecated Use {@link ReadLlmDecisionAnswersConfig} from `@dereekb/llm/decision`.
 */
export type ReadOpenRouterDecisionAnswersConfig<Q extends LlmDecisionQuestions> = ReadLlmDecisionAnswersConfig<Q>;
/**
 * @deprecated Use {@link LlmDecisionAnswersRead} from `@dereekb/llm/decision`.
 */
export type OpenRouterDecisionAnswersRead<Q extends LlmDecisionQuestions> = LlmDecisionAnswersRead<Q>;
/**
 * @deprecated Use {@link LlmStorableDecisionState} from `@dereekb/llm/decision`.
 */
export type OpenRouterStorableDecisionState = LlmStorableDecisionState;
/**
 * @deprecated Use {@link LlmDecisionModelId} from `@dereekb/llm/decision`.
 */
export type OpenRouterSystemOneModelId = LlmDecisionModelId;
