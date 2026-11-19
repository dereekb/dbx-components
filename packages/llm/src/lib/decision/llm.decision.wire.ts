import { type Maybe, mapObjectMap } from '@dereekb/util';
import { type LlmModelId } from '../model/llm.value';
import { llmUsageFrom, type LlmUsage, type LlmUsageFromOptions } from '../strategy/llm.usage';
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
 * A local wire type, deliberately free of any gateway SDK's request surface: it is what the System One transport
 * (`makeLlmSystemOneDecisionStrategy`) sends as its `fetch` body, under the same three field names.
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
 * Every gateway served by `makeLlmSystemOneDecisionStrategy` gets exactly these bytes (`JSON.stringify` of this
 * object). An SDK that re-serializes the body (`@dereekb/openrouter`'s `openRouterDecision`) sends the same JSON value
 * with its keys in the SDK's schema order.
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

/**
 * A decision reply's usage block, as the wire spells it (snake_case), every field optional — a gateway that reports
 * less is recorded as what it reported rather than refused.
 */
export interface LlmDecisionWireUsage {
  /**
   * Input tokens billed.
   */
  readonly input_tokens?: Maybe<number>;
  /**
   * Output tokens (reported, not billed).
   */
  readonly output_tokens?: Maybe<number>;
  /**
   * The gateway's synchronous cost in USD. A numeric string is tolerated, as {@link llmUsageFrom} tolerates it.
   */
  readonly cost?: Maybe<number | string>;
}

/**
 * A decision route's reply, as far as a transport reads it — the System One route's shape, every field optional.
 * Everything under `answers` is handed to `requireLlmDecisionAnswers`, which is the only thing that decides whether it
 * IS an answer set.
 */
export interface LlmDecisionWireReply {
  /**
   * The gateway's generation id, when the body carries one.
   */
  readonly id?: Maybe<string>;
  /**
   * The model that answered; absent ⇒ the requested slug stands.
   */
  readonly model?: Maybe<LlmModelId>;
  /**
   * The upstream provider that served the call.
   */
  readonly provider?: Maybe<string>;
  /**
   * The answers, keyed by question id — untrusted until read.
   */
  readonly answers?: Maybe<Readonly<Record<string, unknown>>>;
  /**
   * The usage block.
   */
  readonly usage?: Maybe<LlmDecisionWireUsage>;
}

/**
 * **The one decision usage fold**: a reply's snake_case usage onto {@link LlmUsage}, through the root's one usage
 * mapper. Input ⇒ prompt, output ⇒ completion, their sum ⇒ total (only when either side was reported), and the
 * gateway's cost — omitted when unreadable, so an absent cost reads downstream as "unknown" rather than "zero".
 *
 * @param usage - The reply's usage block.
 * @param options - What the transport knows about its gateway's cost figure (`{ costBasis }`), passed straight to
 *   {@link llmUsageFrom}.
 * @returns The usage, or `undefined` when the reply carried none.
 *
 * @example
 * ```ts
 * llmUsageFromDecisionUsage({ input_tokens: 3800, output_tokens: 0, cost: 0.000046 });
 * // { promptTokens: 3800, completionTokens: 0, totalTokens: 3800, cost: 0.000046 }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function llmUsageFromDecisionUsage(usage: Maybe<LlmDecisionWireUsage>, options?: Maybe<LlmUsageFromOptions>): Maybe<LlmUsage> {
  const inputTokens = usage?.input_tokens ?? undefined;
  const outputTokens = usage?.output_tokens ?? undefined;

  return usage == null
    ? undefined
    : llmUsageFrom(
        {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens == null && outputTokens == null ? undefined : (inputTokens ?? 0) + (outputTokens ?? 0),
          cost: usage.cost
        },
        options ?? undefined
      );
}
