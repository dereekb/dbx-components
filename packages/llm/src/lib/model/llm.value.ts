/**
 * The LLM **value-type vocabulary**: the semantic string aliases the strategy contract uses in place of bare
 * `string`, so a capability, strategy id, model id or tier key reads as what it is.
 *
 * Every alias is a plain, open `string`: hosts declare their own capabilities, strategies, models and tiers, and the
 * library never narrows the sets.
 *
 * RUNTIME-FREE: the structured value types are derived from the arktype declarations in `llm.model.type.ts`, which
 * this module only `import type`s.
 */

import type { llmModelOutputControlsType, llmModelProviderRefType, llmModelSelectionType, llmModelTierConfigType, llmReasoningConfigType } from './llm.model.type';

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
 * A count of model tokens: prompt, completion, reasoning or cached tokens, or a cap on them.
 *
 * @semanticType
 * @semanticTopic numeric
 */
export type LlmTokenCount = number;

/**
 * A provider's id for one generation (completion), the key a bill reader looks a call up by.
 *
 * @semanticType
 * @semanticTopic identifier
 */
export type LlmGenerationId = string;

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
 *
 * Derived from {@link llmReasoningConfigType}.
 */
export interface LlmReasoningConfig extends Readonly<typeof llmReasoningConfigType.infer> {}

/**
 * The output-length and reasoning controls one layer (a tier, a capability, a routing rule) may set:
 * `{ maxOutputTokens?, reasoning? }`. Derived from {@link llmModelOutputControlsType}.
 */
export interface LlmModelOutputControls extends Readonly<typeof llmModelOutputControlsType.infer> {}

/**
 * How a declaration picks its model: a concrete `model` slug ({@link LlmModelId}), a named `tier`
 * ({@link LlmModelTierKey}), or both. Derived from {@link llmModelSelectionType}.
 */
export interface LlmModelSelection extends Readonly<typeof llmModelSelectionType.infer> {}

/**
 * Which declared provider ({@link LlmStrategyId}) serves a call: `{ provider? }`. Derived from
 * {@link llmModelProviderRefType}.
 */
export interface LlmModelProviderRef extends Readonly<typeof llmModelProviderRefType.infer> {}

/**
 * A per-tier config — the rich {@link LlmModelTierValue} arm: a model slug plus the optional output-length and
 * reasoning controls intrinsic to that tier ({@link LlmModelOutputControls}). A hybrid-reasoning tier that bills
 * reasoning against `max_tokens` declares a larger `maxOutputTokens` and a `reasoning` band here, once, for every
 * capability that routes to it. Derived from {@link llmModelTierConfigType}.
 */
export interface LlmModelTierConfig extends Readonly<typeof llmModelTierConfigType.infer> {}

/**
 * A tier's value — what an {@link LlmModelTierKey} resolves to. Either a bare {@link LlmModelId} slug or a rich
 * {@link LlmModelTierConfig} (`{ model, maxOutputTokens?, reasoning? }`). Readers should resolve it through one
 * helper rather than inspecting the value directly, so a bare-slug tier and a config tier are interchangeable at
 * every call site.
 */
export type LlmModelTierValue = LlmModelId | LlmModelTierConfig;

/**
 * A per-slug map: one value per model slug ({@link LlmModelId}), a slug absent when it has none. The shape of every
 * per-slug projection of a model config file (reasoning-off encodings, vision, prompt addenda, provider bindings).
 */
export type LlmModelSlugMap<V> = Readonly<Partial<Record<LlmModelId, V>>>;
