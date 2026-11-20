/**
 * The semantic critic — the billed, asynchronous sibling of the value validator. A request opts into one; the
 * dispatcher awaits it after the validator passes and reprompts on a `{ error }` verdict within the same bounded
 * retry budget. The critic composition ({@link composeLlmCritics}), the host critique policy
 * ({@link compileLlmCritiquePolicy}) and the binding a critic dispatches its judge through ({@link LlmCritiqueBinding})
 * live here; the judge capability itself lives in `capability/llm.capability.critique.reply.ts`.
 */

import { type Maybe, type Count } from '@dereekb/util';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { compileLlmCapabilityRules, type LlmCapabilityRuleTarget, type LlmModelRoutingCapabilityRef } from '../model/llm.capability.rule';
import { type LlmCapabilityKey, type LlmCapabilityTag, type LlmModelTierKey } from '../model/llm.value';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallMeta, type LlmDispatchResult } from '../strategy/llm.strategy';
import { type LlmReplyProtocol } from './llm.reply.protocol';
import { type LlmReplyVerdict } from './llm.reply.validator';

/**
 * The judge capability's key. Stable: call records and tapes key on it; declared here so the critique compile can exclude it without importing a capability.
 */
export const LLM_CRITIQUE_REPLY_CAPABILITY: LlmCapabilityKey = 'CritiqueReply';

/**
 * The default label prefix of a {@link compileLlmCritiquePolicy} error (`<label> rule #<n>: …`).
 */
export const DEFAULT_LLM_CRITIQUE_POLICY_LABEL = 'llm critique';

/**
 * What an {@link LlmCritic} is shown about the SUBJECT call it is judging — assembled by the DISPATCHER, which
 * already holds every field at the moment an attempt's reply comes back.
 *
 * Non-generic on purpose: `critique` is a REQUEST field, and a request-typed input would make a host's narrower
 * critic unassignable (function parameters are contravariant).
 */
export interface LlmCritiqueParams {
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
   * The unwrapped value the subject reply produced — already past the subject's validator, so a critic may quote its
   * structured fields without re-checking their shape.
   */
  readonly value: Readonly<Record<string, unknown>>;
  /**
   * The RAW reply text of the attempt under review — the only faithful view of a `line` reply (whose value is
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
  /**
   * The subject request's cancellation signal — a critic hands it to its judge request, so a request-level cancel
   * reaches the judge call too.
   */
  readonly signal?: Maybe<AbortSignal>;
}

/**
 * The opaque ASYNC critic the dispatcher awaits after the validator passes. Its {@link LlmReplyVerdict}: `true` ⇒ accept
 * the reply as-is; `{ error }` ⇒ reprompt the SUBJECT with that feedback (a critique correction on the volatile
 * suffix), within the subject's remaining attempt budget. The dispatcher never builds one and never
 * inspects what it checks — exactly as it never inspects what an `LlmValueValidator` checks.
 *
 * A critic MUST NOT throw: an unreachable / broken judge is a fail-OPEN `true` (an unjudged reply ships), never an
 * exception that takes the subject dispatch down with it. BILLED: every pass is an extra LLM call, so a critiqued
 * capability costs `1 + attempts` calls.
 */
export type LlmCritic = (input: LlmCritiqueParams) => Promise<LlmReplyVerdict>;

/**
 * Compose critics into ONE, run in order: the FIRST non-`true` verdict wins, so a later (billed) critic is never
 * awaited for a reply an earlier one already sent back — a cheap deterministic critic composes BEFORE a billed judge on
 * the same capability. Absent critics are skipped; none present ⇒ `undefined` (the request carries no critic at all),
 * and exactly one ⇒ that critic itself.
 *
 * @param critics - The critics, in the order they run.
 * @returns The composed critic, or `undefined`.
 */
export function composeLlmCritics(...critics: ReadonlyArray<Maybe<LlmCritic>>): Maybe<LlmCritic> {
  const present = critics.filter((critic): critic is LlmCritic => critic != null);
  let composed: Maybe<LlmCritic>;

  if (present.length === 1) {
    composed = present[0];
  } else if (present.length > 1) {
    composed = async (input) => {
      let verdict: LlmReplyVerdict = true;

      for (const critic of present) {
        if (verdict === true) {
          verdict = await critic(input);
        }
      }

      return verdict;
    };
  }

  return composed;
}

/**
 * One host-declared critique rule, targeting capabilities by key and/or tag exactly as a model routing rule does.
 */
export interface LlmCritiqueRule extends LlmCapabilityRuleTarget {
  /**
   * The exact capability keys this rule attaches a critic to. A capability-key match beats any tag match, regardless of
   * rule order.
   */
  readonly capabilities?: ReadonlyArray<LlmCapabilityKey>;
  /**
   * The capability tags this rule targets. Within the tag level, the FIRST matching rule wins (array order = priority).
   * {@link LLM_CRITIQUE_REPLY_CAPABILITY} is EXCLUDED from tag matching outright, so a tag rule can never sweep the
   * judge into judging itself.
   */
  readonly tags?: ReadonlyArray<LlmCapabilityTag>;
  /**
   * OVERRIDE the capability's own declared goal (the statement of what a good reply must contain). Omitted ⇒ the goal
   * the capability supplied through `resolveLlmCritiqueFields`.
   */
  readonly goal?: string;
  /**
   * The named model tier the JUDGE call routes to — a per-rule cost dial (run the judge cheap). Omitted ⇒ the judge
   * descriptor's own tier / the default tier.
   */
  readonly tier?: LlmModelTierKey;
  /**
   * TOTAL SUBJECT attempts while this critic is attached — the reprompt budget a failing verdict spends against.
   * Omitted ⇒ the dispatcher default; clamped `>= 1` by the dispatcher.
   */
  readonly maxAttempts?: Count;
}

/**
 * The host-facing critique config — an ordered rule list. Absent / rule-less ⇒ NO capability gets a critic (the
 * off-by-default contract).
 */
export interface LlmCritiqueConfig {
  /**
   * The ordered critique rules. Capability-key matches beat tag matches; within a level, the first match wins.
   */
  readonly rules?: ReadonlyArray<LlmCritiqueRule>;
}

/**
 * The compiled per-capability critique lookup an {@link LlmCritiqueBinding} carries — one map lookup per
 * `resolveLlmCritiqueFields` call. A capability absent from the map gets NO critic.
 */
export type LlmCompiledCritiquePolicy = ReadonlyMap<LlmCapabilityKey, LlmCritiqueRule>;

/**
 * The inputs {@link compileLlmCritiquePolicy} compiles one critique config against.
 */
export interface CompileLlmCritiquePolicyConfig {
  /**
   * The host's critique config.
   */
  readonly critique: LlmCritiqueConfig;
  /**
   * The known capability refs (key + tags) — a capability descriptor fits as-is.
   */
  readonly capabilities: ReadonlyArray<LlmModelRoutingCapabilityRef>;
  /**
   * The error-message label prefix. Defaults to {@link DEFAULT_LLM_CRITIQUE_POLICY_LABEL}.
   */
  readonly label?: Maybe<string>;
}

/**
 * Compile a host critique config into the per-capability policy map — validated FAIL-LOUD, the
 * `compileLlmModelRouting` discipline: an unknown capability key, a tag no capability carries, a rule with no target,
 * or a rule naming {@link LLM_CRITIQUE_REPLY_CAPABILITY} each THROW at startup (a typo'd config reddens the boot rather
 * than silently billing nothing — or, for the last one, silently billing forever). The precedence is pre-applied: a
 * rule naming a capability key beats any tag-matching rule; within each level the first matching rule (array order)
 * wins.
 *
 * The judge capability is excluded from TAG matching outright — the second recursion guard.
 *
 * @param config - The critique config, the known capability refs and the label.
 * @returns The compiled capability → rule map (empty when the config declares no rules).
 * @throws {Error} When a rule references an unknown capability / tag, declares no target, or names the judge.
 */
export function compileLlmCritiquePolicy(config: CompileLlmCritiquePolicyConfig): LlmCompiledCritiquePolicy {
  return compileLlmCapabilityRules<LlmCritiqueRule, LlmCritiqueRule>({
    rules: config.critique.rules,
    capabilities: config.capabilities,
    label: config.label ?? DEFAULT_LLM_CRITIQUE_POLICY_LABEL,
    // The judge can never be named, and is skipped by tag matching — the two layers of the recursion guard.
    exclude: [{ capability: LLM_CRITIQUE_REPLY_CAPABILITY, reason: `'${LLM_CRITIQUE_REPLY_CAPABILITY}' is the judge itself and can never be critiqued (a judge judging a judge is unbounded).` }],
    readValue: (rule) => rule
  });
}

/**
 * The dispatch a critic issues its judge call through.
 */
export type LlmCritiqueDispatch = (request: LlmDispatchRequest) => Promise<LlmDispatchResult>;

/**
 * The opt-in carrier a host hands its capabilities — the compiled policy plus the dispatch a critic issues its judge
 * call through. Absent ⇒ no capability can attach a critic (off is free).
 *
 * The STRUCTURAL recursion guard: `critiqueLlmReply` builds the judge request WITHOUT a `critique`, and a host's
 * `dispatch` must not add one — so a judge call can never be judged.
 */
export interface LlmCritiqueBinding {
  /**
   * The compiled per-capability policy (which capabilities the host attached a critic to, and how).
   */
  readonly policy: LlmCompiledCritiquePolicy;
  /**
   * The judge's dispatch. A host normally closes over its own request fields here.
   */
  readonly dispatch: LlmCritiqueDispatch;
}
