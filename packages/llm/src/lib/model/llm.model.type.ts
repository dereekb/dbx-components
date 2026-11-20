/**
 * The arktype declarations behind the model VALUE vocabulary — a tier value, its reasoning block, and the three
 * building blocks every `{ model, tier, maxOutputTokens, reasoning, provider }` declaration composes
 * ({@link llmModelSelectionType}, {@link llmModelProviderRefType}, {@link llmModelOutputControlsType}).
 *
 * The TypeScript interfaces are DERIVED from these (`typeof xType.infer`) in `llm.value.ts`, which only `import type`s
 * this module, so the type vocabulary stays runtime-free. The field docs live here and survive `.infer`.
 *
 * Every object type ends in `.readonly()` (arktype's readonly is shallow, so each nested object carries its own).
 */

import { type } from 'arktype';
import { LLM_REASONING_EFFORTS } from './llm.model.wire';

// MARK: Scalars
/**
 * A string carrying at least one non-whitespace character. The value is NOT trimmed by the check; a reader that
 * wants the trimmed text trims it when it assembles its output.
 */
export const llmNonBlankStringType = /*#__PURE__*/ type('string').narrow((value, ctx) => value.trim().length > 0 || ctx.mustBe('non-blank'));

/**
 * A model slug: non-empty AND already trimmed. A slug is matched EXACTLY against `models[slug]` bindings and provider
 * catalogs, so a stray space is rejected rather than silently trimmed into a different key.
 */
export const llmModelSlugType = /*#__PURE__*/ type('string.trim.preformatted').atLeastLength(1);

/**
 * A model tier key (`fast`, `strong`, …) — any non-blank string.
 */
export const llmModelTierKeyType = llmNonBlankStringType;

/**
 * A token count — a positive integer. A fractional cap is a typo, never a budget. It validates an `LlmTokenCount`
 * (`llm.value.ts`); a field it types keeps the inferred `number`, because a primitive alias does not survive `.infer`.
 */
export const llmTokenCountType = /*#__PURE__*/ type('number.integer > 0');

/**
 * A reasoning-effort band (`LLM_REASONING_EFFORTS`).
 */
export const llmReasoningEffortType = /*#__PURE__*/ type.enumerated(...LLM_REASONING_EFFORTS);

// MARK: Reasoning
/**
 * The transport-agnostic reasoning controls (`LlmReasoningConfig`).
 */
export const llmReasoningConfigType = /*#__PURE__*/ type({
  /**
   * The reasoning effort budget band — `'low'` / `'medium'` / `'high'`. Omitted ⇒ the provider's default.
   */
  'effort?': llmReasoningEffortType,
  /**
   * A hard cap on reasoning tokens (an alternative to `effort` for providers that take a token budget) — a positive
   * integer. Omitted ⇒ the provider's default.
   */
  'maxTokens?': llmTokenCountType,
  /**
   * Whether to EXCLUDE the reasoning trace from the returned completion (reason internally, omit the trace from the
   * reply). Omitted ⇒ the provider's default.
   */
  'exclude?': 'boolean',
  /**
   * Whether reasoning is enabled at all — `false` disables it on a model that reasons by default. Omitted ⇒ the
   * provider's default.
   */
  'enabled?': 'boolean'
})
  .readonly()
  .narrow((value, ctx) => !Array.isArray(value) || ctx.mustBe('an object')); // arktype's object domain admits arrays

// MARK: Building blocks
/**
 * The output-length and reasoning controls a tier, a capability or a routing rule may set (`LlmModelOutputControls`).
 */
export const llmModelOutputControlsType = /*#__PURE__*/ type({
  /**
   * The completion-length cap (the `max_tokens` a call is sent with) — a positive integer. Omitted ⇒ the next layer's
   * cap, and finally the strategy's own default.
   */
  'maxOutputTokens?': llmTokenCountType,
  /**
   * The reasoning controls (`LlmReasoningConfig`). Omitted ⇒ the next layer's controls; with none anywhere, no
   * reasoning param is sent (the byte-stable default).
   */
  'reasoning?': llmReasoningConfigType
}).readonly();

/**
 * How a declaration picks its model — a concrete slug, a named tier, or both (`LlmModelSelection`).
 */
export const llmModelSelectionType = /*#__PURE__*/ type({
  /**
   * A concrete model slug (`LlmModelId`). Wins over `tier` when both are set.
   */
  'model?': llmModelSlugType,
  /**
   * A named model tier key (`LlmModelTierKey`), resolved to a slug through the host's tier map.
   */
  'tier?': llmModelTierKeyType
}).readonly();

/**
 * Which declared provider serves the call (`LlmModelProviderRef`).
 */
export const llmModelProviderRefType = /*#__PURE__*/ type({
  /**
   * The declared provider name (`LlmStrategyId`) that serves the call. Omitted ⇒ the default provider.
   */
  'provider?': llmNonBlankStringType
}).readonly();

// MARK: Tier value
/**
 * A rich tier config — a model slug plus the tier's output controls (`LlmModelTierConfig`).
 */
export const llmModelTierConfigType = /*#__PURE__*/ llmModelOutputControlsType
  .merge({
    /**
     * The concrete model slug (`LlmModelId`) this tier resolves to.
     */
    model: llmModelSlugType
  })
  .readonly();

/**
 * A tier's value — a bare model slug or a rich tier config (`LlmModelTierValue`).
 */
export const llmModelTierValueType = /*#__PURE__*/ llmModelSlugType.or(llmModelTierConfigType);

// MARK: Routing rule
/**
 * What a routing rule targets — capabilities by key and/or by tag.
 */
export const llmModelRoutingRuleTargetsType = /*#__PURE__*/ type({
  /**
   * The exact capability keys (`LlmCapabilityKey`) this rule targets (e.g. `["reply-line"]`). A capability-key match
   * beats any tag match, regardless of rule order.
   */
  'capabilities?': type.string.array().readonly(),
  /**
   * The capability tags (`LlmCapabilityTag`) this rule targets (e.g. `["dialog"]` for a whole family). Within the tag
   * level, the FIRST matching rule wins (array order = priority).
   */
  'tags?': type.string.array().readonly()
}).readonly();

/**
 * One host-declared routing rule (`LlmModelRoutingRule`): its targets, the route (a selection), the provider it is
 * served by, and per-rule output controls.
 */
export const llmModelRoutingRuleType = /*#__PURE__*/ llmModelRoutingRuleTargetsType.merge(llmModelSelectionType).merge(llmModelProviderRefType).merge(llmModelOutputControlsType).readonly();
