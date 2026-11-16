import { type Maybe, mapObjectMap } from '@dereekb/util';
import { type LlmDecisionModelId } from './llm.decision.model';
import { type LlmDecisionEntry, type LlmDecisionQuestion, type LlmDecisionQuestionId, type LlmDecisionState, llmDecisionChoiceOptionNames } from './llm.decision.question';
import { type LlmDecisionRequest } from './llm.decision.strategy';

/**
 * One declared question in the shape the wire carries it.
 *
 * All three primitives collapse onto a single `criteria` key, which is why this mapping exists at all:
 * the declaration types name what each primitive's criteria MEAN (`options`, `levels`, `means`), and the
 * wire does not.
 */
export type LlmDecisionWireQuestion =
  | { readonly type: 'choice'; readonly instructions: LlmDecisionEntry; readonly criteria: Readonly<Record<string, Maybe<LlmDecisionEntry>>> }
  | { readonly type: 'score'; readonly instructions: LlmDecisionEntry; readonly criteria: readonly LlmDecisionEntry[] }
  | { readonly type: 'noul'; readonly instructions: LlmDecisionEntry; readonly criteria?: { readonly true: LlmDecisionEntry; readonly false: LlmDecisionEntry } };

/**
 * Converts one declared question to its wire shape.
 *
 * A pure rename. Three details carry meaning and are not incidental:
 *
 * - an option with no description becomes an explicit `null`, which is how the wire spells "undescribed
 *   option" — omitting the key would instead remove the option from the answer space;
 * - a Noul with no `means` omits `criteria` ENTIRELY rather than sending an empty object;
 * - a structured entry is passed through by IDENTITY, never copied or re-serialized, because the wire
 *   carries declaration guidance verbatim and a normalising round-trip is exactly the kind of silent
 *   edit this mapping must not make.
 *
 * @param question - The declared question.
 * @returns The wire question.
 */
export function llmDecisionWireQuestion(question: LlmDecisionQuestion): LlmDecisionWireQuestion {
  let result: LlmDecisionWireQuestion;

  switch (question.type) {
    case 'choice':
      result = {
        type: 'choice',
        instructions: question.instructions,
        criteria: llmDecisionChoiceOptionNames(question).reduce<Record<string, Maybe<LlmDecisionEntry>>>((all, option) => {
          all[option] = question.options[option] ?? null;
          return all;
        }, {})
      };
      break;
    case 'score':
      result = { type: 'score', instructions: question.instructions, criteria: [...question.levels] };
      break;
    case 'noul':
      result = { type: 'noul', instructions: question.instructions, ...(question.means == null ? undefined : { criteria: { true: question.means.true, false: question.means.false } }) };
      break;
  }

  return result;
}

/**
 * The decision route's request body — exactly `model`, `state` and `questions`, in that order.
 *
 * A local wire type, deliberately free of any gateway SDK's request surface: a transport hands it to its own
 * client (an SDK's `decisionsRequest`, a `fetch` body) under the same three field names.
 */
export interface LlmDecisionRequestBody {
  /**
   * The decision model that should answer.
   */
  readonly model: LlmDecisionModelId;
  /**
   * The content to judge.
   */
  readonly state: LlmDecisionState;
  /**
   * The declared questions, each in its wire shape.
   */
  readonly questions: Readonly<Record<LlmDecisionQuestionId, LlmDecisionWireQuestion>>;
}

/**
 * Converts a decision request into the decision route's request body.
 *
 * The body is built field by field — `model`, `state`, `questions` — and the request is never spread, so a
 * host that extends {@link LlmDecisionRequest} cannot leak a key into the body. That is a wire requirement, not
 * tidiness: ZenMux answers 400 to any body key other than these three (`user`, `metadata`, `trace` and
 * `session_id` included). Gateway-specific keys, such as OpenRouter's session grouping or trace metadata, belong
 * to that gateway's own body builder.
 *
 * The output is byte-identical to the OpenRouter body for the same model, state and questions, so a transport
 * may switch between the two without changing a byte on the wire.
 *
 * @param request - The decision request.
 * @returns The request body.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function llmDecisionRequestBody(request: LlmDecisionRequest): LlmDecisionRequestBody {
  return {
    model: request.model,
    state: request.state,
    questions: mapObjectMap(request.questions, (question) => llmDecisionWireQuestion(question))
  };
}
