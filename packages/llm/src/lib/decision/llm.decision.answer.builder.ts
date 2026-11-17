/**
 * Decision answer builders — the inverse of {@link readLlmDecisionAnswers}' membership check.
 *
 * A hand-written Choice distribution over forty options is unreadable and easy to get subtly wrong, and a malformed one
 * is refused by the reader, which is correct but makes a spec fail for the wrong reason. These builders produce answers
 * that are well-formed by construction, so a spec or a replay script states only which option won and how surely.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmDecisionChoiceAnswer, type LlmDecisionEntry, type LlmDecisionNoulAnswer, type LlmDecisionScoreAnswer, type LlmDecisionScoreLevels } from './llm.decision.question';

/**
 * The mass {@link llmDecisionChoiceAnswerOf} puts on the winning option when no confidence is given.
 */
export const DEFAULT_LLM_DECISION_CHOICE_ANSWER_CONFIDENCE = 0.9;

/**
 * The mass {@link llmDecisionScoreAnswerOf} puts on the nearest level when no confidence is given.
 */
export const DEFAULT_LLM_DECISION_SCORE_ANSWER_CONFIDENCE = 0.8;

/**
 * Config for {@link llmDecisionChoiceAnswerOf}.
 */
export interface LlmDecisionChoiceAnswerOfConfig<O extends string> {
  /**
   * Every declared option name.
   */
  readonly options: ReadonlyArray<O>;
  /**
   * The winning option.
   */
  readonly choice: O;
  /**
   * The mass on the winner, 0 to 1; absent ⇒ {@link DEFAULT_LLM_DECISION_CHOICE_ANSWER_CONFIDENCE}.
   */
  readonly confidence?: Maybe<number>;
}

/**
 * Build a well-formed **Choice** answer: the named option carries `confidence` of the mass and the rest is spread evenly
 * over the others, so the distribution sums to 1 and the intended option wins. A single-option Choice takes the whole
 * mass — there was nothing to be unsure between.
 *
 * @param config - The declared options, which one won, and how surely.
 * @returns The answer.
 *
 * @example
 * ```ts
 * const answer = llmDecisionChoiceAnswerOf({ options: ['alpha', 'beta'], choice: 'beta', confidence: 0.7 });
 * // { type: 'choice', choice: 'beta', probabilities: { alpha: 0.3, beta: 0.7 }, confidence: 0.7 }
 * ```
 */
export function llmDecisionChoiceAnswerOf<O extends string>(config: LlmDecisionChoiceAnswerOfConfig<O>): LlmDecisionChoiceAnswer<O> {
  const confidence = config.confidence ?? DEFAULT_LLM_DECISION_CHOICE_ANSWER_CONFIDENCE;
  const others = config.options.filter((option) => option !== config.choice);
  const spread = others.length === 0 ? 0 : (1 - confidence) / others.length;
  const winnerMass = others.length === 0 ? 1 : confidence;
  const probabilities = config.options.reduce<Record<string, number>>((all, option) => ({ ...all, [option]: option === config.choice ? winnerMass : spread }), {});

  return { type: 'choice', choice: config.choice, probabilities: probabilities as Record<O, number>, confidence };
}

/**
 * Config for {@link llmDecisionScoreAnswerOf}.
 */
export interface LlmDecisionScoreAnswerOfConfig {
  /**
   * The declared ordered levels.
   */
  readonly levels: LlmDecisionScoreLevels;
  /**
   * The score, within `0..levels.length - 1`.
   */
  readonly score: number;
  /**
   * The mass on the nearest level, 0 to 1; absent ⇒ {@link DEFAULT_LLM_DECISION_SCORE_ANSWER_CONFIDENCE}.
   */
  readonly confidence?: Maybe<number>;
}

/**
 * Build a well-formed **Score** answer, with the mass on the level nearest the score (clamped to the declared range). The
 * `legend` echoes each declared level verbatim keyed by its index (a structured level comes back as its object), the way
 * the live wire does.
 *
 * @param config - The declared levels, the score and its confidence.
 * @returns The answer.
 *
 * @example
 * ```ts
 * const answer = llmDecisionScoreAnswerOf({ levels: ['cold', 'warm', 'hot'], score: 1.6 }); // mass 0.8 on '2'
 * ```
 */
export function llmDecisionScoreAnswerOf(config: LlmDecisionScoreAnswerOfConfig): LlmDecisionScoreAnswer {
  const confidence = config.confidence ?? DEFAULT_LLM_DECISION_SCORE_ANSWER_CONFIDENCE;
  const nearest = Math.min(config.levels.length - 1, Math.max(0, Math.round(config.score)));
  const others = config.levels.length - 1;
  const spread = others === 0 ? 0 : (1 - confidence) / others;
  const legend = config.levels.reduce<Record<string, LlmDecisionEntry>>((all, level, index) => ({ ...all, [String(index)]: level }), {});
  const probabilities = config.levels.reduce<Record<string, number>>((all, _level, index) => ({ ...all, [String(index)]: index === nearest ? confidence : spread }), {});

  return { type: 'score', score: config.score, legend, probabilities, confidence };
}

/**
 * Build a **Noul** answer.
 *
 * @param noul - The probability that the answer is yes, 0 to 1.
 * @returns The answer.
 *
 * @example
 * ```ts
 * const answer = llmDecisionNoulAnswerOf(0.3); // { type: 'noul', noul: 0.3 }
 * ```
 */
export function llmDecisionNoulAnswerOf(noul: number): LlmDecisionNoulAnswer {
  return { type: 'noul', noul };
}
