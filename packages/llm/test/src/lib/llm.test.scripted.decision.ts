/**
 * **The scripted decision backend — how a decision is proved free.** The decision-lane counterpart of the tape strategy.
 * A decision has no prompt bytes to record and no reply text to replay, so a script here is simply a function from a
 * request to the answers it should produce: a spec asserts the WHOLE billed surface (the state assembled, the questions
 * declared, the answers read back) with no key, no network and no spend.
 *
 * Build the script's answers with the root builders (`llmDecisionChoiceAnswerOf`, `llmDecisionScoreAnswerOf`,
 * `llmDecisionNoulAnswerOf` from `@dereekb/llm`), which are well-formed by construction.
 *
 * @see LlmDecisionStrategy (the seam these answers must satisfy).
 */

import { type Maybe } from '@dereekb/util';
import { LlmDecisionAnswerFaultError, type LlmDecisionAnswer, type LlmDecisionQuestions, type LlmDecisionRequest, type LlmDecisionResult, type LlmDecisionStrategy, type LlmStrategyId, readLlmDecisionAnswers } from '@dereekb/llm';

/**
 * The default instance id AND the kind a scripted decision backend declares, so a run artifact can never mistake a
 * replayed decision for a billed one.
 */
export const SCRIPTED_LLM_DECISION_STRATEGY_ID: LlmStrategyId = 'scripted-decision';

/**
 * What a scripted backend answers one request with — the whole answer map, keyed the way the request declared its
 * questions.
 *
 * @param request - The decision request.
 * @returns The raw answers, read through `readLlmDecisionAnswers` exactly as a live reply would be.
 */
export type ScriptedLlmDecisionScript = <Q extends LlmDecisionQuestions>(request: LlmDecisionRequest<Q>) => Readonly<Record<string, unknown>>;

/**
 * Config for {@link makeScriptedLlmDecisionStrategy}.
 */
export interface ScriptedLlmDecisionStrategyConfig {
  /**
   * Answer one request. Every declared question must be answered, or the strategy refuses the reply exactly as a live
   * transport would — a spec cannot accidentally assert against a half-read answer set.
   */
  readonly script: ScriptedLlmDecisionScript;
  /**
   * The INSTANCE id; absent ⇒ {@link SCRIPTED_LLM_DECISION_STRATEGY_ID}.
   */
  readonly id?: Maybe<LlmStrategyId>;
  /**
   * An optional sink every request is pushed to, so a spec can assert the STATE assembled and the QUESTIONS declared,
   * not merely the answers taken back.
   */
  readonly requests?: Maybe<LlmDecisionRequest[]>;
}

/**
 * Build a scripted decision backend.
 *
 * @param config - The script, the id and an optional request sink.
 * @returns The strategy. Its `decide` rejects with an `LlmDecisionAnswerFaultError` when the script under-answers or
 *   answers malformed.
 *
 * @example
 * ```ts
 * const strategy = makeScriptedLlmDecisionStrategy({ script: () => ({ pick: llmDecisionChoiceAnswerOf({ options: ['a', 'b'], choice: 'b' }) }) });
 * ```
 */
export function makeScriptedLlmDecisionStrategy(config: ScriptedLlmDecisionStrategyConfig): LlmDecisionStrategy {
  const decide = async <Q extends LlmDecisionQuestions>(request: LlmDecisionRequest<Q>): Promise<LlmDecisionResult<Q>> => {
    config.requests?.push(request as LlmDecisionRequest);

    const read = readLlmDecisionAnswers({ questions: request.questions, raw: config.script(request) as Readonly<Record<string, Maybe<LlmDecisionAnswer>>> });

    if (read.faults != null) {
      throw new LlmDecisionAnswerFaultError(read.faults);
    }

    // A ZERO usage rather than an absent one: a replayed decision genuinely cost nothing, and reporting that as a reading
    // (rather than as "unaccounted") keeps a scripted run's ledger honest.
    return { model: request.model, answers: read.answers, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 } };
  };

  return {
    id: config.id ?? SCRIPTED_LLM_DECISION_STRATEGY_ID,
    kind: SCRIPTED_LLM_DECISION_STRATEGY_ID,
    describe: 'a scripted decision backend: replayed answers, never billed',
    decide
  };
}
