/**
 * The LLM **value-type vocabulary**: the semantic string aliases the strategy contract uses in place of bare
 * `string`, so a capability, strategy id, model id or tier key reads as what it is.
 *
 * Every alias is a plain, open `string`: hosts declare their own capabilities, strategies, models and tiers, and the
 * library never narrows the sets.
 */

/**
 * A capability key: the name of the job a call does (`'summarize'`, `'classify-intent'`, …). It is the join key
 * between a prompt, its reply schema and strategy selection, so one capability names one reply shape everywhere.
 */
export type LlmCapabilityKey = string;

/**
 * A strategy id. Names either a registered strategy instance (the `id` axis) or a transport kind (the `kind` axis);
 * both axes use this alias. Orthogonal to the {@link LlmModelId} model axis.
 */
export type LlmStrategyId = string;

/**
 * A model id: the model slug a strategy routes by (e.g. an OpenRouter slug such as `'openai/gpt-4o-mini'`). It is
 * transport-agnostic, never bound to one backend, so the same slug may be served by several strategies.
 */
export type LlmModelId = string;

/**
 * A named model tier key: the config handle a capability or prompt routes to instead of a raw {@link LlmModelId}
 * slug (`tier: 'strong'`). An open set: a host declares any number of keys (`fast`, `strong`, `cheap`, `vision`, …)
 * and maps each to a model. Tiers are resolved to a concrete slug above the transport, so a strategy always
 * receives a model id, never a tier key.
 */
export type LlmModelTierKey = string;

/**
 * A capability tag: a coarse grouping handle stamped on a capability so a model-routing rule can target a whole
 * family of capabilities at once (`{ tags: ['dialog'], tier: 'dialog' }`) instead of enumerating each key. An open
 * set: a capability may carry any string a host wants to route on.
 */
export type LlmCapabilityTag = string;

/**
 * The transport-agnostic **reasoning controls** for one LLM call, read by a reasoning-tier model (some models bill
 * their reasoning tokens against `max_tokens`). Every field is optional and `readonly`, so an unset config is a
 * no-op, and the shape is provider-neutral: a strategy maps it onto its own transport (OpenRouter's `reasoning`
 * param), and a strategy that cannot reason ignores it.
 *
 * NEVER sent unconfigured: a strategy stamps it onto the wire only when a config resolves (some providers reject an
 * unknown `reasoning` param), so the no-reasoning wire body stays byte-identical.
 */
export interface LlmReasoningConfig {
  /**
   * The reasoning effort budget band — `'low'` / `'medium'` / `'high'`. Omitted ⇒ the provider's default.
   */
  readonly effort?: 'low' | 'medium' | 'high';
  /**
   * A hard cap on reasoning tokens (an alternative to {@link effort} for providers that take a token budget).
   * Omitted ⇒ the provider's default.
   */
  readonly maxTokens?: number;
  /**
   * Whether to EXCLUDE the reasoning trace from the returned completion (reason internally, omit the trace from
   * the reply). Omitted ⇒ the provider's default.
   */
  readonly exclude?: boolean;
  /**
   * Whether reasoning is enabled at all — `false` disables it on a model that reasons by default. Omitted ⇒ the
   * provider's default.
   */
  readonly enabled?: boolean;
}

/**
 * A per-tier config — the rich {@link LlmModelTierValue} arm: a model slug plus the optional output-length and
 * reasoning controls intrinsic to that tier. A hybrid-reasoning tier that bills reasoning against `max_tokens`
 * declares a larger {@link maxOutputTokens} and a {@link reasoning} band here, once, for every capability that
 * routes to it.
 */
export interface LlmModelTierConfig {
  /**
   * The concrete model slug this tier resolves to.
   */
  readonly model: LlmModelId;
  /**
   * The tier's default completion-length cap (the `max_tokens` a call routed here is sent with, unless the
   * capability overrides it). Omitted ⇒ the strategy's own default cap.
   */
  readonly maxOutputTokens?: number;
  /**
   * The tier's default reasoning controls ({@link LlmReasoningConfig}). Omitted ⇒ no reasoning param sent (the
   * byte-stable default).
   */
  readonly reasoning?: LlmReasoningConfig;
}

/**
 * A tier's value — what an {@link LlmModelTierKey} resolves to. Either a bare {@link LlmModelId} slug or a rich
 * {@link LlmModelTierConfig} (`{ model, maxOutputTokens?, reasoning? }`). Readers should resolve it through one
 * helper rather than inspecting the value directly, so a bare-slug tier and a config tier are interchangeable at
 * every call site.
 */
export type LlmModelTierValue = LlmModelId | LlmModelTierConfig;
