/**
 * **DECLARING a decision — the input is specified, and the answers follow from it.**
 *
 * A prompt capability's input is an assembled STRING, with the reply shape declared separately as a response schema
 * the model is asked to honour. Nothing ties the two together, which is why the reply has to be validated back into
 * the shape afterwards.
 *
 * A decision has no such gap. One {@link LlmDecisionDescriptor} declares, from ONE typed input:
 *
 * - `state` — the content to judge, and
 * - `questions` — the answer space, as typed questions.
 *
 * Both are functions of the same `input`, so a call site cannot assemble a state without declaring the questions that
 * read it, and the ANSWER type is derived from the questions rather than asserted beside them
 * ({@link LlmDecisionAnswers}). Declare a Choice over three literal options and the answer's `choice` is a union of
 * exactly those three, checked at compile time; build the option set at runtime and it widens to `string` while
 * keeping the runtime membership guarantee the transport enforces.
 *
 * ```ts
 * const pickDepartment = defineLlmDecision({
 *   decision: 'pick-department',
 *   describe: 'route one support ticket to the team that should own it',
 *   state: (input: { readonly ticket: string }) => ({ ticket: input.ticket }),
 *   questions: () => ({
 *     team: llmChoiceQuestion('Which team should handle `ticket`?', { billing: 'Payments and refunds', technical: 'Bugs and integrations' }),
 *     actionable: llmNoulQuestion('`ticket` describes a concrete problem rather than a general enquiry.')
 *   })
 * });
 *
 * const { answers } = await pickDepartment.decide({ strategy, input: { ticket }, model });
 * answers.team.choice;        // 'billing' | 'technical'  — never anything else
 * answers.team.probabilities; // a probability for BOTH teams: the ranking, free
 * answers.actionable.noul;    // 0..1
 * ```
 */

import type { Maybe } from '@dereekb/util';
import type { LlmDispatchRequestBase } from '../dispatch/llm.dispatch.request';
import type { LlmCapabilityModelRef } from '../model/llm.model.precedence';
import type { LlmModelId } from '../model/llm.value';
import { type LlmDecisionAnswers, type LlmDecisionKey, type LlmDecisionQuestions, type LlmDecisionState, LlmDecisionDeclarationError, validateLlmDecisionQuestions } from './llm.decision.question';
import type { LlmDecideOptions, LlmDecisionRequest, LlmDecisionResult, LlmDecisionStrategy } from './llm.decision.strategy';

/**
 * **One declared decision.** Everything a call site needs to state about the judgement it wants, over one typed
 * input.
 *
 * A host that declares more per decision (what its decisions consume, say) extends this interface; the descriptor
 * is handed back by identity on {@link LlmDecision.descriptor}, so the extension survives.
 *
 * Its OPTIONAL `model` (a raw decision-model id, the one-off escape hatch that wins over `tier`) and `tier` (a tier key
 * whose slug is a decision model) are the descriptor rungs of the dispatcher's model precedence, below a per-call
 * override and a capability route that names a decision model, above the dispatcher's `decisions.defaultModel`. A
 * slug that is not a decision model throws before the decision is sent.
 */
export interface LlmDecisionDescriptor<I, Q extends LlmDecisionQuestions> extends Pick<LlmCapabilityModelRef, 'tier' | 'model'> {
  /**
   * The key this decision is reported under.
   */
  readonly decision: LlmDecisionKey;
  /**
   * A one-line description of the judgement — what a reader of a catalog or a diagnostic sees.
   */
  readonly describe: string;
  /**
   * Build the state to judge.
   *
   * Send the fields the questions actually read. Accuracy falls as a state grows with material unrelated to the
   * decision, so this is where filtering belongs — a wide state is not a free hedge.
   *
   * @param input - The decision's input.
   * @returns The state.
   */
  readonly state: (input: I) => LlmDecisionState;
  /**
   * Declare the questions — the answer space.
   *
   * Every question sees the same state and is evaluated independently, so declare EVERY question this input could
   * need in one descriptor, including speculative ones the caller may discard: the state is paid for once and a
   * question costs only its own tokens. Ask one snap judgement per question; a judgement that weighs several
   * independent factors is several questions combined in code.
   *
   * @param input - The decision's input.
   * @returns The question set.
   */
  readonly questions: (input: I) => Q;
}

/**
 * Params for {@link LlmDecision.asRequest}.
 */
export interface LlmDecisionAsRequestParams<I> {
  /**
   * The decision's input.
   */
  readonly input: I;
  /**
   * The model to ask.
   */
  readonly model: LlmModelId;
}

/**
 * Params for {@link LlmDecision.decide}.
 */
export interface LlmDecisionDecideParams<I> extends LlmDecisionAsRequestParams<I> {
  /**
   * The backend to ask.
   */
  readonly strategy: LlmDecisionStrategy;
  /**
   * Optional per-call concerns.
   */
  readonly options?: LlmDecideOptions;
}

/**
 * A declared decision, ready to run — the descriptor plus the two things a caller does with it.
 */
export interface LlmDecision<I, Q extends LlmDecisionQuestions> {
  /**
   * The declaration this was built from, by identity.
   */
  readonly descriptor: LlmDecisionDescriptor<I, Q>;
  /**
   * Project one input into a transport request, WITHOUT running it — the seam every free spec reads, and what makes
   * a decision's whole billed surface assertable without a backend.
   *
   * @param params - The input and the model that would answer.
   * @returns The request.
   */
  asRequest(params: LlmDecisionAsRequestParams<I>): LlmDecisionRequest<Q>;
  /**
   * Run the decision against one backend.
   *
   * @param params - The backend, the input, the model and any per-call concerns.
   * @returns The typed answers and the usage.
   */
  decide(params: LlmDecisionDecideParams<I>): Promise<LlmDecisionResult<Q>>;
}

/**
 * **One decision, as a DISPATCHER takes it.**
 *
 * A decision goes through a dispatcher rather than straight at a {@link LlmDecisionStrategy} when the host records
 * its calls: the dispatcher is what writes the call record and the cost, so a consumer calling `strategy.decide()`
 * itself records nothing.
 *
 * It carries the DECLARED decision rather than the bare descriptor because the projection
 * ({@link LlmDecision.asRequest}) is the seam: the dispatcher never re-derives a state or a question set, it asks
 * the declaration for one. The descriptor rides along inside it and is what the dispatcher's model precedence reads.
 *
 * It shares {@link LlmDispatchRequestBase} with a completion request. `capability` is the CONSUMING capability this
 * decision is being made for — the caller's capability, not the decision key. Telemetry records under it, so a
 * decision arm and the text arm it replaces land in the SAME capability cell and an A/B reads off the strategy split;
 * that is why the decision lane needs no new capability key and no ledger change. `model` / `tier` are the per-call
 * rungs of the model precedence (each must name a decision model), `callContext` is the parent the decision's context
 * nests under, and `meta` is host data the library never reads, carried to the host's own record hooks.
 */
export interface LlmDecisionDispatchRequest<I = unknown, Q extends LlmDecisionQuestions = LlmDecisionQuestions> extends LlmDispatchRequestBase {
  /**
   * The declared decision to run.
   */
  readonly decision: LlmDecision<I, Q>;
  /**
   * The decision's input — what {@link LlmDecisionDescriptor.state} and `.questions` are projected from.
   */
  readonly input: I;
  /**
   * The consumer's own READ of the answers, stamped onto the call record beside the decision key, so a log reader
   * reads what the call DECIDED off the record alone. Called once the answers are read; a throwing stamp is the
   * dispatcher's to swallow, and stamps nothing. Its keys never override the record's own fields. Absent ⇒ the
   * record is byte-identical.
   */
  readonly stamp?: (answers: LlmDecisionAnswers<Q>) => Maybe<Readonly<Record<string, unknown>>>;
}

/**
 * **Declare a decision.** The factory every decision call site goes through.
 *
 * Nothing is frozen and nothing is registered: the result is a plain object holding the caller's descriptor by
 * identity. Validation is lazy — every {@link LlmDecision.asRequest} validates the questions it projected and throws
 * {@link LlmDecisionDeclarationError}, naming the decision, when they cannot be asked. An EMPTY question map is
 * refused like any other malformed declaration (it asks nothing), so a consumer whose input can yield zero questions
 * short-circuits BEFORE `asRequest` rather than catching this.
 *
 * @param descriptor - The declaration: the key, the state projection and the questions.
 * @returns The declared decision.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function defineLlmDecision<I, Q extends LlmDecisionQuestions>(descriptor: LlmDecisionDescriptor<I, Q>): LlmDecision<I, Q> {
  const asRequest = (params: LlmDecisionAsRequestParams<I>): LlmDecisionRequest<Q> => {
    const questions = descriptor.questions(params.input);
    const validation = validateLlmDecisionQuestions(questions);

    if (!validation.valid) {
      throw new LlmDecisionDeclarationError(validation.errors, descriptor.decision);
    }

    return { state: descriptor.state(params.input), questions, model: params.model };
  };

  return {
    descriptor,
    asRequest,
    decide: (params) => params.strategy.decide(asRequest({ input: params.input, model: params.model }), params.options)
  };
}
