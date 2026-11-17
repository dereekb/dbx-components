/**
 * The prompt handles — a chainable, execute-once wrapper around one LLM call, so a caller can (a) fire a prompt
 * exactly once and reuse its result, and (b) chain follow-up messages onto the SAME exchanged thread (replaying the
 * prior turns byte-identically, which is what keeps the provider's content-addressed prompt cache warm across the
 * chain).
 *
 * Design-wise this is the `fetchPageFactory` linked-chain pattern from `@dereekb/util/fetch` applied to prompts: an
 * {@link LlmPrompt} holds its input plus a `cachedGetter`-wrapped {@link LlmPrompt.execute} (re-invoking never
 * re-fires the call — it returns the SAME executed instance); the {@link ExecutedLlmPrompt} node wraps the returned
 * result, back-references the prompt that produced it (whose cached `execute` is how the result is reused), and
 * chains via {@link ExecutedLlmPrompt.followUp}. The handles are generic over the request type `R` and the result
 * type `X`, and the factory's ONE seam is {@link LlmPromptFactoryConfig.runPromptRequest}.
 *
 * NB: `cachedGetter` caches the first promise, INCLUDING a rejected one — a failed execution is not retried by
 * re-calling `execute`; prepare a fresh prompt to retry.
 *
 * Types only for now: the factory (`makeLlmPromptFactory`), the recorded-turn cap and the configurable
 * degenerate-thread placeholder join this module later.
 */

import { type CachedGetter, type Maybe } from '@dereekb/util';
import { type LlmLeverValidator } from '../reply/llm.reply.validator';
import { type LlmDispatchResult, type LlmThreadTurn } from '../strategy/llm.strategy';

/**
 * The input of one chained follow-up message — the new user content plus the per-turn levers a follow-up may
 * override. Everything else (capability, model, strategy, host fields) is inherited from the chain's root request:
 * cache reuse requires the same model + provider anyway, and the reply protocol already governing the thread came
 * from the root's assembly.
 */
export interface LlmPromptFollowUp {
  /**
   * The follow-up user message appended to the exchanged thread.
   */
  readonly content: string;
  /**
   * OPT-IN bounded-retry validator for THIS turn's reply (the same contract as the request's `validate`). Unset ⇒
   * single-shot.
   */
  readonly validate?: LlmLeverValidator;
  /**
   * Total attempts the {@link validate} loop may make for this turn (the request's `maxAttempts` contract).
   */
  readonly maxAttempts?: number;
  /**
   * An advisory reply-shape hint for THIS turn. Unset ⇒ the root request's resolved hint is inherited (a JSON chain
   * keeps enforcing its schema on every turn).
   */
  readonly responseSchemaHint?: unknown;
}

/**
 * A prepared, not-yet-executed prompt — the chain node BEFORE its transition fires (the `FetchPage` analog).
 * Executing is cached: however many times {@link execute} is invoked, the underlying call fires once and the same
 * {@link ExecutedLlmPrompt} instance is returned.
 *
 * @typeParam R - The request type the chain roots on.
 * @typeParam X - The dispatch result type an execution returns.
 */
export interface LlmPrompt<R, X extends LlmDispatchResult = LlmDispatchResult> {
  /**
   * The ROOT request this chain was initialized from (every follow-up inherits its context).
   */
  readonly request: R;
  /**
   * The follow-up input this prompt was chained with — set on a chained prompt, absent on the root.
   */
  readonly followUp?: Maybe<LlmPromptFollowUp>;
  /**
   * The executed parent this prompt chains from — its {@link ExecutedLlmPrompt.thread} is replayed ahead of this
   * prompt's message. Absent on the root.
   */
  readonly previous?: Maybe<ExecutedLlmPrompt<R, X>>;
  /**
   * Execute the prompt. If it has already executed, returns the same reference and does not fire the call again (a
   * rejected execution is also cached — prepare a fresh prompt to retry).
   */
  readonly execute: CachedGetter<Promise<ExecutedLlmPrompt<R, X>>>;
}

/**
 * An executed prompt — the chain node AFTER its transition fired (the `FetchNextPage` analog). Wraps the raw
 * {@link result}, back-references the {@link prompt} that produced it (whose cached `execute` returns this same
 * instance — the reuse handle), and chains the next message via {@link followUp}.
 *
 * @typeParam R - The request type the chain roots on.
 * @typeParam X - The dispatch result type an execution returns.
 */
export interface ExecutedLlmPrompt<R, X extends LlmDispatchResult = LlmDispatchResult> {
  /**
   * The prompt that produced this result — its cached {@link LlmPrompt.execute} resolves to THIS instance, so holding
   * either side of the pair reuses the one underlying call.
   */
  readonly prompt: LlmPrompt<R, X>;
  /**
   * The raw dispatch result this execution returned — the wrapped value a capability parses.
   */
  readonly result: X;
  /**
   * The full exchanged thread INCLUDING this execution's user turn + assistant reply, oldest first — exactly what a
   * chained follow-up replays (`user` turns carry the FINAL prompt variant that produced the accepted reply, so the
   * replayed bytes match what the provider cached).
   */
  readonly thread: ReadonlyArray<LlmThreadTurn>;
  /**
   * Chain a follow-up prompt onto this exchange — a new not-yet-executed {@link LlmPrompt} whose execution replays
   * {@link thread} ahead of the follow-up content. Chaining never re-fires this (or any prior) call.
   *
   * @param followUp - The follow-up message + its per-turn levers.
   * @returns The chained, not-yet-executed prompt.
   */
  readonly followUp: (followUp: LlmPromptFollowUp) => LlmPrompt<R, X>;
}

/**
 * The inputs of one {@link LlmPromptFactoryConfig.runPromptRequest} call — the chain's root request, the prior turns
 * to replay (empty for the root execution), and the follow-up input when this execution is a chained turn.
 *
 * @typeParam R - The request type the chain roots on.
 */
export interface LlmPromptRunParams<R> {
  /**
   * The ROOT request the chain was initialized from.
   */
  readonly request: R;
  /**
   * The prior exchanged turns to replay ahead of this call, oldest first (empty ⇒ the root execution).
   */
  readonly thread: ReadonlyArray<LlmThreadTurn>;
  /**
   * The follow-up input when this execution is a chained turn; absent on the root execution.
   */
  readonly followUp?: Maybe<LlmPromptFollowUp>;
}

/**
 * The outputs of one {@link LlmPromptFactoryConfig.runPromptRequest} call — the raw result plus the user turn as it
 * was FINALLY sent (retry corrections included), which the chain appends to the thread so a follow-up replays the
 * exact bytes the provider cached.
 *
 * @typeParam X - The dispatch result type.
 */
export interface LlmPromptRunResult<X extends LlmDispatchResult = LlmDispatchResult> {
  /**
   * The raw dispatch result the call returned.
   */
  readonly result: X;
  /**
   * The user turn as finally sent — content is the FINAL prompt variant that produced {@link result} (with any retry
   * correction), and a segmented root turn keeps its cache split for byte-identical block replay.
   */
  readonly sentTurn: LlmThreadTurn;
  /**
   * Whether this call's reply was DEGENERATE — a malformed / truncated / unparseable completion the dispatch hit a
   * decode failure on and never recovered. When `true` the chain records the degenerate-thread placeholder as the
   * assistant turn INSTEAD of the raw (poisoned) reply text, so a later follow-up never replays — and the provider
   * never re-bills — a garbage turn. Omitted / `false` ⇒ the reply is recorded verbatim (capped).
   */
  readonly degenerate?: boolean;
}

/**
 * Config for a prompt factory.
 *
 * @typeParam R - The request type the chain roots on.
 * @typeParam X - The dispatch result type.
 */
export interface LlmPromptFactoryConfig<R, X extends LlmDispatchResult = LlmDispatchResult> {
  /**
   * The ONE transport seam — run a single prepared call (root or follow-up) and report the result plus the user turn
   * as finally sent. A dispatcher's implementation assembles / routes / validates / records; a spec fake returns
   * canned results.
   */
  readonly runPromptRequest: (params: LlmPromptRunParams<R>) => Promise<LlmPromptRunResult<X>>;
}

/**
 * Creates a new root {@link LlmPrompt} instance from a request.
 *
 * @typeParam R - The request type the chain roots on.
 * @typeParam X - The dispatch result type.
 */
export type LlmPromptFactory<R, X extends LlmDispatchResult = LlmDispatchResult> = (request: R) => LlmPrompt<R, X>;
