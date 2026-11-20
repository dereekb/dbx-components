/**
 * The completion request — what a capability hands an `LlmDispatcher`: the capability key, the deferred live-context
 * renderer, the per-call overrides, the opt-in reply checks, the prompt site and the parent call context.
 *
 * A host carries its own fields by extension (`interface HostRequest extends LlmDispatchRequest { … }`), including a
 * narrower `site` with a typed supply, and passes the extended type as a dispatcher's `R`.
 *
 * {@link LlmDispatchRequestBase} is what a completion shares with a decision (`LlmDecisionDispatchRequest`): the
 * capability, host meta, the per-call model overrides, the parent call context and the cancellation signal.
 */

import { type AbortSignalRef } from '@dereekb/util';
import { type LlmCapabilityKey, type LlmModelId, type LlmModelTierKey, type LlmReasoningConfig } from '../model/llm.value';
import { type LlmPromptSite } from '../prompt/llm.prompt.site';
import { type LlmLiveContextBlock } from '../prompt/llm.prompt.live.context';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCritic } from '../reply/llm.reply.critique';
import { type LlmReplyProtocol } from '../reply/llm.reply.protocol';
import { type LlmLeverValidator } from '../reply/llm.reply.validator';
import { type LlmAttachment, type LlmCallMeta } from '../strategy/llm.strategy';

/**
 * What every dispatcher call carries, on either lane — a capability completion ({@link LlmDispatchRequest}) or a
 * decision (`LlmDecisionDispatchRequest`). The host hooks that receive a request see these fields on both lanes.
 */
export interface LlmDispatchRequestBase extends AbortSignalRef {
  /**
   * The capability the call is made for — on a completion, the template, descriptor and strategy-selection key; on a
   * decision, the CONSUMING capability (the caller's, not the decision key), whose cell the decision records under.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * Host data about the call (its subject, its correlation ids) — opaque to the library, forwarded to the call record
   * and the host hooks.
   */
  readonly meta?: LlmCallMeta;
  /**
   * A PER-INVOCATION model TIER override — a tier key the dispatcher resolves against the active tier map, WINNING over
   * the descriptor's `tier` / `model`. Lets a single call route to a stronger tier without editing its descriptor.
   * Omitted ⇒ fall through to the descriptor's tier / the default.
   */
  readonly tier?: LlmModelTierKey;
  /**
   * A PER-INVOCATION RAW model override — a concrete slug that bypasses the tier registry, the HIGHEST-precedence
   * override (above {@link tier}). For a one-off slug a caller has in hand; prefer {@link tier}. Omitted ⇒ fall
   * through the tier precedence.
   */
  readonly model?: LlmModelId;
  /**
   * The PARENT call context this call nests under — threaded by the caller (a turn / phase scope) so the per-call
   * timing profile nests under whatever phase spawned it. Omitted ⇒ the call profiles standalone.
   */
  readonly callContext?: LlmCallContext;
}

/**
 * One capability call, as a dispatcher receives it.
 */
export interface LlmDispatchRequest extends LlmDispatchRequestBase {
  /**
   * A PER-INVOCATION reasoning override — the HIGHEST-precedence reasoning input, winning over the capability
   * descriptor, the resolved tier config AND the host floor (precedence `request > descriptor > tier > floor`,
   * mirroring the {@link tier} model axis). Lets one dispatch spend reasoning without every routine call of the
   * capability doing so. Omitted ⇒ fall through the descriptor / tier / floor precedence.
   */
  readonly reasoning?: LlmReasoningConfig;
  /**
   * The capability's volatile live-context renderer, deferred so a non-firing policy skips the cost.
   *
   * Returns KEYED {@link LlmLiveContextBlock}s, one per section — each becoming its own provenance-tagged prompt
   * segment in the live slot, so a prompt inspector can name (and a cross-call diff can fold on) the section that moved.
   * Build them with `llmLiveContextBlock` / `llmLiveContextHeadingBlock`; join them with `joinLlmLiveContextBlocks`
   * when a caller genuinely needs bytes.
   */
  readonly renderLiveContext: () => ReadonlyArray<LlmLiveContextBlock>;
  /**
   * The reply protocol of THIS call — wins over the descriptor's and the host default (`resolveLlmReplyProtocol`).
   * Omitted ⇒ the descriptor's, else the host default.
   */
  readonly replyProtocol?: LlmReplyProtocol;
  /**
   * Ask a `line` call for its delivery note too (the line-manner amendment). Ignored by the JSON protocols.
   */
  readonly lineManner?: boolean;
  /**
   * An advisory reply-shape hint forwarded to the strategy (a structured-output backend MAY use it).
   */
  readonly responseSchemaHint?: unknown;
  /**
   * An override for the CLOSING sentence of the prompt's output contract. Omitted ⇒ the host's
   * `texts.outputContractFooter`, else `DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER`; `''` drops the footer. Root-only,
   * like every other assembly input: a chained follow-up replays the root turn, so the contract already rides its
   * thread.
   */
  readonly contractFooter?: string;
  /**
   * Non-text inputs to send with the ROOT call — carried through the bounded-retry loop, so a corrected re-ask still
   * sees them; a chained FOLLOW-UP turn omits them, because they already rode the replayed root turn.
   */
  readonly attachments?: ReadonlyArray<LlmAttachment>;
  /**
   * OPT-IN bounded-retry validator. When set, the dispatcher unwraps the reply; a `null` lever (no JSON / a decline)
   * short-circuits with NO retry; a non-`null` lever is handed to this opaque closure, and a `{ error }` verdict
   * reprompts (the error appended to the volatile suffix only, so the cache prefix stays byte-stable), capped at
   * {@link maxAttempts}. Unset ⇒ single-shot.
   */
  readonly validate?: LlmLeverValidator;
  /**
   * OPT-IN SEMANTIC critic — the billed, ASYNC sibling of {@link validate}. It runs AFTER `validate` passes (a
   * malformed reply is never sent to a judge), on the SAME bounded-retry budget: a `{ error }` verdict reprompts with
   * a critique correction appended to the volatile suffix only, capped at {@link maxAttempts}. BILLED: every pass is
   * an extra LLM call, so a critiqued capability costs `1 + attempts` calls.
   *
   * ROOT-ONLY: a chained follow-up turn is never critiqued (its `validate` still comes off the follow-up).
   */
  readonly critique?: LlmCritic;
  /**
   * The capability this call is a JUDGEMENT OF — set ONLY by a critic's or fixer's own request, and recorded as the
   * call record's `subject` so judge spend attributes to what it judged with no join. Omitted by every ordinary
   * dispatch.
   */
  readonly subjectCapability?: LlmCapabilityKey;
  /**
   * The single lever FIELD a `line` reply lifts into when the bounded-retry loop synthesizes a lever for a
   * {@link critique} pass; default `'line'`. Consulted ONLY on the `line` + `critique` path.
   */
  readonly lineLeverField?: string;
  /**
   * Total strategy attempts (initial + retries) the {@link validate} / {@link critique} loop may make; default 2
   * (1 initial + 1 retry), clamped to `>= 1`. Ignored when both are unset.
   */
  readonly maxAttempts?: number;
  /**
   * The token budget this call's live context was rendered against. When set AND the fully-assembled prompt's
   * estimated tokens exceed it, the dispatcher reports an over-budget gap and SENDS ANYWAY (never blocks). Omitted ⇒
   * no over-budget gap.
   */
  readonly maxPromptTokens?: number;
  /**
   * WHERE this prompt is being built ({@link LlmPromptSite}) — the typed facts, free-text inputs and supplies the
   * prompt contributors match against. Read ONLY by contributors; changes no byte by itself.
   */
  readonly site?: LlmPromptSite;
}
