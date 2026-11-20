/**
 * The provider-neutral **wire vocabulary**: the names for how one call is spoken on an OpenAI-compatible chat wire.
 *
 * It lives in core rather than beside a transport so the model config, the env layer and every reporting surface
 * share ONE list with the transport that sends it — what an operator is told cannot drift from what goes on the wire,
 * and no config or reporting code needs to import a transport entry.
 *
 * - **Reasoning OFF.** The flat `reasoning_effort` string has no `false`, so "reasoning is off" needs an explicit
 *   encoding; omitting the param means "provider default", which on a hybrid-reasoning model means reasoning ON.
 * - **Token limit.** The request key carrying the completion-length cap varies by gateway (`max_tokens` on the
 *   classic Chat Completions surface, `max_completion_tokens` on the newer / reasoning-model surface).
 * - **Vision.** Opt-in per slug, because a text-only model answers a multimodal body with a `400` while a
 *   vision-capable model called with plain text simply answers from the descriptions.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmModelId, type LlmModelSlugMap, type LlmReasoningConfig } from './llm.value';

/**
 * Every legal {@link LlmReasoningOffEncoding}, in the order error messages print them — the ONE list every parser,
 * error message and CLI help reads.
 *
 * - `'effort-none'` (default) — `reasoning_effort: 'none'`, the documented no-reasoning band on both OpenAI and
 *   OpenRouter's effort enum.
 * - `'effort-minimal'` — `reasoning_effort: 'minimal'`, for a gateway that rejects `'none'`.
 * - `'nested-disabled'` — the OpenRouter-flavoured `reasoning: { enabled: false }`, for an aggregator that proxies
 *   OpenRouter semantics behind an OpenAI-compatible path.
 * - `'omit'` — send nothing. The escape hatch for a strict gateway that rejects every encoding above; a run under it
 *   should be flagged by a reasoning-floor detector rather than silently billed.
 *
 * This list is the source of truth. The transport's encoding → wire-params map is typed
 * `Readonly<Record<LlmReasoningOffEncoding, …>>`, so adding an encoding here is one edit and the compiler forces the
 * transport to map it — a validator can never accept an encoding the transport cannot send.
 */
export const LLM_REASONING_OFF_ENCODINGS = ['effort-none', 'effort-minimal', 'nested-disabled', 'omit'] as const;

/**
 * How an OpenAI-compatible transport encodes "reasoning is OFF" ({@link LLM_REASONING_OFF_ENCODINGS}).
 */
export type LlmReasoningOffEncoding = (typeof LLM_REASONING_OFF_ENCODINGS)[number];

/**
 * The reasoning-OFF encoding used when nothing more specific is configured — `reasoning_effort: 'none'`, the
 * documented no-reasoning band on both OpenAI and OpenRouter's effort enum.
 */
export const DEFAULT_LLM_REASONING_OFF_ENCODING: LlmReasoningOffEncoding = 'effort-none';

/**
 * Every legal reasoning-effort band, in ascending order — the one list behind {@link LlmReasoningEffort}, the tier
 * parser's check and its error message. A transport maps each band onto its own wire value.
 */
export const LLM_REASONING_EFFORTS = ['low', 'medium', 'high'] as const;

/**
 * A reasoning-effort band ({@link LLM_REASONING_EFFORTS}).
 */
export type LlmReasoningEffort = (typeof LLM_REASONING_EFFORTS)[number];

/**
 * Every legal {@link LlmTokenLimitParam}, for the fail-loud parse of a declared provider's `tokenLimitParam` and the
 * error message that lists the legal values.
 */
export const LLM_TOKEN_LIMIT_PARAMS = ['max_tokens', 'max_completion_tokens'] as const;

/**
 * Which request key carries the completion-length cap. The Chat Completions API historically took `max_tokens`; the
 * newer / reasoning-model surface takes `max_completion_tokens`. Gateways vary, so it is configurable per provider.
 */
export type LlmTokenLimitParam = (typeof LLM_TOKEN_LIMIT_PARAMS)[number];

/**
 * The token-limit request key used when a provider configures none — the widest-compatible `max_tokens`.
 */
export const DEFAULT_LLM_TOKEN_LIMIT_PARAM: LlmTokenLimitParam = 'max_tokens';

/**
 * PER-MODEL reasoning-OFF encodings, keyed by the exact slug sent on the wire — the shape a host resolves from the
 * `models` block of its model config and the transport consumes. `Partial` because {@link LlmModelId} is an open
 * string: every key is optional, and an absent slug falls back to the provider / global encoding.
 */
export type LlmModelReasoningOffMap = LlmModelSlugMap<LlmReasoningOffEncoding>;

/**
 * PER-MODEL vision capability, keyed by the exact slug sent on the wire — the {@link LlmModelReasoningOffMap} twin.
 * `true` ⇒ the slug accepts multimodal content parts, so a request carrying attachments sends its images inline;
 * anything else (including an absent entry) ⇒ the plain-string message, and the attachments are not sent.
 *
 * Default-OFF is the safe direction: a model that cannot see images answers a multimodal body with a `400`, while a
 * vision-capable model called with plain text just answers from the descriptions. So an operator opts a slug IN
 * rather than out.
 */
export type LlmModelVisionMap = LlmModelSlugMap<boolean>;

/**
 * Whether a value is one of the {@link LLM_TOKEN_LIMIT_PARAMS}.
 *
 * @param value - The candidate value.
 * @returns `true` when the value is a legal token-limit param.
 */
export function isLlmTokenLimitParam(value: unknown): value is LlmTokenLimitParam {
  return typeof value === 'string' && (LLM_TOKEN_LIMIT_PARAMS as ReadonlyArray<string>).includes(value);
}

/**
 * Parse a raw, env-style value into an {@link LlmReasoningOffEncoding} (trimmed, case-insensitive).
 *
 * LENIENT: unset, blank or unrecognized ⇒ `undefined`, so the caller's default applies and a typo never reddens
 * startup. The loud surface for a bad encoding is the model config file parse, where the operator wrote it down
 * deliberately.
 *
 * Lives in core because every host reader (an env layer, a test lane, a CLI) needs the same membership test, and
 * several copies of it are several chances to disagree about an arm.
 *
 * @param raw - The raw value (or undefined).
 * @returns The parsed encoding, or `undefined` when unset / unrecognized.
 */
export function parseLlmReasoningOffEncoding(raw: Maybe<string>): Maybe<LlmReasoningOffEncoding> {
  const value = raw?.trim().toLowerCase();
  return LLM_REASONING_OFF_ENCODINGS.find((encoding) => encoding === value);
}

/**
 * Config for {@link llmReasoningOffEncodingFor}.
 */
export interface LlmReasoningOffEncodingForConfig {
  /**
   * The slug being sent; absent ⇒ the per-model map cannot apply.
   */
  readonly model?: Maybe<LlmModelId>;
  /**
   * The per-model encodings (`models[slug].reasoningOff`).
   */
  readonly byModel?: Maybe<LlmModelReasoningOffMap>;
  /**
   * The less specific default — the caller folds the provider-level `reasoningOff` and the host's global setting
   * into this one value. Absent ⇒ {@link DEFAULT_LLM_REASONING_OFF_ENCODING}.
   */
  readonly fallback?: Maybe<LlmReasoningOffEncoding>;
}

/**
 * Resolve WHICH reasoning-OFF encoding one slug is sent with — the single definition of the precedence, shared by
 * the transport and by every surface that REPORTS it, so what an operator is told cannot drift from what goes on the
 * wire.
 *
 * ```
 * models[slug].reasoningOff  >  providers[p].reasoningOff  >  the host's global  >  DEFAULT_LLM_REASONING_OFF_ENCODING
 * ```
 *
 * (the caller folds the provider and global levels into `fallback`). Specificity, not surface, orders these: the
 * per-model entry is a FACT about the model (this one rejects `'none'`), while the fallback is a blunt default.
 * Letting the default win would mean fixing one troublesome slug drops the reasoning floor on every well-behaved one.
 *
 * @param config - The slug being sent, the per-model map, and the fallback.
 * @returns The encoding to send.
 */
export function llmReasoningOffEncodingFor(config: LlmReasoningOffEncodingForConfig): LlmReasoningOffEncoding {
  const { model, byModel, fallback } = config;
  return (model == null ? undefined : byModel?.[model]) ?? fallback ?? DEFAULT_LLM_REASONING_OFF_ENCODING;
}

/**
 * Normalize the reasoning-OFF precedence ONCE, before any wire mapper reads the config: an explicit `enabled: false`
 * outranks every co-present knob (`effort`, `maxTokens`, `exclude`), so an OFF config reaches every transport as
 * `{ enabled: false }` alone. Any other config passes through unchanged (the same reference); an absent one stays
 * absent. The OpenAI-compatible chat base calls it before its `reasoningParams` hook, so the mappers stay pure.
 *
 * @param reasoning - The resolved reasoning config, if any.
 * @returns The normalized config — `{ enabled: false }` for an OFF config, the input otherwise.
 *
 * @example
 * ```ts
 * normalizeLlmReasoningConfig({ enabled: false, effort: 'high' }); // { enabled: false }
 * normalizeLlmReasoningConfig({ effort: 'low' }); // the same object
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function normalizeLlmReasoningConfig(reasoning: LlmReasoningConfig): LlmReasoningConfig;
export function normalizeLlmReasoningConfig(reasoning: Maybe<LlmReasoningConfig>): Maybe<LlmReasoningConfig>;
// @__NO_SIDE_EFFECTS__
export function normalizeLlmReasoningConfig(reasoning: Maybe<LlmReasoningConfig>): Maybe<LlmReasoningConfig> {
  let normalized: Maybe<LlmReasoningConfig>;

  if (reasoning == null) {
    normalized = undefined;
  } else if (reasoning.enabled === false) {
    normalized = { enabled: false };
  } else {
    normalized = reasoning;
  }

  return normalized;
}
