/**
 * The semantic critic — the billed, asynchronous sibling of the lever validator. A request opts into one; the
 * dispatcher awaits it after the validator passes and reprompts on a `{ error }` verdict within the same bounded
 * retry budget. The critique policy and the critic composition join this module later.
 */

import { type LlmCapabilityKey } from '../model/llm.value';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallMeta } from '../strategy/llm.strategy';
import { type LlmReplyProtocol } from './llm.reply.protocol';

/**
 * What an {@link LlmCritic} is shown about the SUBJECT call it is judging — assembled by the DISPATCHER, which
 * already holds every field at the moment an attempt's reply comes back.
 *
 * Non-generic on purpose: `critique` is a REQUEST field, and a request-typed input would make a host's narrower
 * critic unassignable (function parameters are contravariant).
 */
export interface LlmCritiqueInput {
  /**
   * The capability under review — the SUBJECT of the judgement (never the judge's own key).
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The subject request's host data (its `meta`), when it carries any — what a critic reads to build its own judge
   * request for the same subject.
   */
  readonly meta?: LlmCallMeta;
  /**
   * The unwrapped lever the subject reply produced — already past the subject's validator, so a critic may quote its
   * structured fields without re-checking their shape.
   */
  readonly lever: Readonly<Record<string, unknown>>;
  /**
   * The RAW reply text of the attempt under review — the only faithful view of a `line` reply (whose lever is
   * synthesized from it).
   */
  readonly replyText: string;
  /**
   * The rendered live context this attempt was produced against — the context the critic judges the reply's fit to.
   * Empty for a chained follow-up turn (which re-renders no live context).
   */
  readonly liveContext: string;
  /**
   * The subject's effective reply protocol, so the critic can phrase its feedback for prose vs JSON.
   */
  readonly replyProtocol: LlmReplyProtocol;
  /**
   * The 1-based attempt ordinal of the SUBJECT call this verdict is about.
   */
  readonly attempt: number;
  /**
   * The subject attempt's call context — the critic's own dispatch nests under it, so the judge call's cost lands
   * inside the subject attempt's timing profile.
   */
  readonly callContext: LlmCallContext;
}

/**
 * A critic's verdict — `true` ⇒ accept the reply as-is; `{ error }` ⇒ reprompt the SUBJECT with that feedback (a
 * critique correction on the volatile suffix), within the subject's remaining attempt budget.
 */
export type LlmCritiqueVerdict = true | { readonly error: string };

/**
 * The opaque ASYNC critic the dispatcher awaits after the validator passes. The dispatcher never builds one and never
 * inspects what it checks — exactly as it never inspects what an `LlmLeverValidator` checks.
 *
 * A critic MUST NOT throw: an unreachable / broken judge is a fail-OPEN `true` (an unjudged reply ships), never an
 * exception that takes the subject dispatch down with it. BILLED: every pass is an extra LLM call, so a critiqued
 * capability costs `1 + attempts` calls.
 */
export type LlmCritic = (input: LlmCritiqueInput) => Promise<LlmCritiqueVerdict>;
