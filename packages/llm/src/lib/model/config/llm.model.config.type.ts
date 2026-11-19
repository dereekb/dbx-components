/**
 * The arktype declarations behind a model config file's entries — a `providers` entry and a per-slug `models` entry.
 *
 * The TypeScript interfaces (`LlmProviderEntryBase`, `LlmCompletionProviderEntry`, `LlmModelSettings`) are DERIVED
 * from these (`typeof xType.infer`) in `llm.model.config.schema.ts`, so the declaration and its check cannot drift. The
 * field docs live here and survive `.infer`.
 *
 * The static types check SHAPE only (`transport` / `metering` / `decision` are open strings here): the legal
 * values are the host's, so {@link makeLlmModelConfigEntryTypes} narrows them once per schema.
 */

import { type } from 'arktype';
import { llmNonBlankStringType } from '../llm.model.type';
import { LLM_REASONING_OFF_ENCODINGS, LLM_TOKEN_LIMIT_PARAMS } from '../llm.model.wire';
import { type LlmStrategyId } from '../llm.value';
import { type LlmProviderStatusProviderId } from '../../strategy/llm.provider.status';

// MARK: Static types
/**
 * What every `providers` entry carries, whichever kind it is (`LlmProviderEntryBase`).
 */
export const llmProviderEntryBaseType = /*#__PURE__*/ type({
  /**
   * The transport (the strategy KIND, `LlmStrategyId`) this provider is served by. The entry's NAME is the strategy
   * instance id a slug or routing rule binds to. Absent on disk ⇒ the schema's default transport.
   */
  transport: llmNonBlankStringType,
  /**
   * The endpoint base URL. Absent ⇒ the transport's own default.
   */
  'baseUrl?': llmNonBlankStringType,
  /**
   * WHICH env var supplies this provider's key — the var NAME, never the secret.
   */
  'apiKeyEnv?': llmNonBlankStringType
}).readonly();

/**
 * ONE declared completion provider (`LlmCompletionProviderEntry`).
 */
export const llmCompletionProviderEntryType = /*#__PURE__*/ llmProviderEntryBaseType
  .merge({
    /**
     * WHICH env var supplies this provider's key — REQUIRED on a completion provider, and deliberately so: the usual
     * reason a second provider exists is that it bills a different key, and a provider that silently inherited the
     * default one would bill the wrong account.
     */
    apiKeyEnv: llmNonBlankStringType,
    /**
     * The PROVIDER-level reasoning-OFF wire encoding (`LlmReasoningOffEncoding`) — the default for every slug this
     * provider serves. Two-level by necessity: the same slug served by two providers can differ (a local build that
     * rejects `reasoning_effort` beside a gateway that honours it), so the per-slug `reasoningOff` still wins over this.
     */
    'reasoningOff?': type.enumerated(...LLM_REASONING_OFF_ENCODINGS),
    /**
     * Which request key carries the completion-length cap (`LlmTokenLimitParam`) — a property of the ENDPOINT, so it
     * belongs here rather than in a global setting every provider would share.
     */
    'tokenLimitParam?': type.enumerated(...LLM_TOKEN_LIMIT_PARAMS),
    /**
     * Opt into aggregator usage accounting so the reply carries a cost. OFF by default because a strict
     * OpenAI-compatible endpoint (a local vLLM) may reject the unknown param.
     */
    'usageAccounting?': 'boolean',
    /**
     * The account-metering source for this provider's quota reads (`LlmProviderStatusProviderId`) — one of the schema's
     * meterings, or `'none'` (`LLM_PROVIDER_FACET_NONE`). Absent ⇒ inferred from the provider's base URL by a
     * registered metering adapter (`llmProviderMeteringOf`); a provider that meters nothing should say `'none'`.
     */
    'metering?': 'string',
    /**
     * The decision route this provider serves decisions through (`LlmStrategyId`) — one of the schema's decision
     * routes, or `'none'`. Absent ⇒ the route a registered decision adapter serves for the transport
     * (`llmProviderDecisionRouteOf`), else `'none'`.
     */
    'decision?': 'string'
  })
  .readonly();

/**
 * The per-SLUG facts of a `models` entry (`LlmModelSettings`).
 */
export const llmModelSettingsType = /*#__PURE__*/ type({
  /**
   * The provider NAME (`LlmStrategyId`) that serves this slug. Shape-checked by the parse; that the name resolves is
   * checked over the MERGED file, where a binding to a built-in provider is finally visible.
   */
  'provider?': llmNonBlankStringType,
  /**
   * This slug's reasoning-OFF encoding (`LlmReasoningOffEncoding`) — wins over the provider's and the host's.
   */
  'reasoningOff?': type.enumerated(...LLM_REASONING_OFF_ENCODINGS),
  /**
   * Whether this slug accepts image content parts. Default OFF: a text-only model answers a multimodal body with a
   * `400`, while a vision model called with plain text just answers from the descriptions.
   */
  'vision?': 'boolean',
  /**
   * Text PREPENDED to every dispatch that resolves to this slug, so it rides in the cacheable prefix. A blank one is
   * rejected rather than read as absent — an operator who cleared the text but kept the key meant to say something.
   */
  'promptAddendum?': llmNonBlankStringType
}).readonly();

// MARK: Per-schema types
/**
 * Config for {@link makeLlmModelConfigEntryTypes} — a schema's normalized value lists.
 */
export interface LlmModelConfigEntryTypesConfig {
  /**
   * Every legal `transport` (completion transports, then the extension's).
   */
  readonly entryTransports: ReadonlyArray<LlmStrategyId>;
  /**
   * Every legal `metering` (ending in `'none'`).
   */
  readonly meterings: ReadonlyArray<LlmProviderStatusProviderId>;
  /**
   * Every legal `decision` (ending in `'none'`).
   */
  readonly decisionRoutes: ReadonlyArray<LlmStrategyId>;
}

/**
 * Build the per-schema entry checks from the static types — once, at schema build — so the legal transports, meterings
 * and decision routes are the schema's while every other field rule stays the static one.
 *
 * - `providerEntryBaseType`: the checks every entry passes before it is routed (`transport?` — absent ⇒ the default —
 *   and `baseUrl?`).
 * - `completionProviderEntryType`: a completion entry in full, `transport` optional (already defaulted by the router).
 *
 * @param config - The schema's normalized value lists.
 * @returns The two arktype types.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmModelConfigEntryTypes(config: LlmModelConfigEntryTypesConfig) {
  const transportType = type.enumerated(...config.entryTransports);
  const providerEntryBaseType = llmProviderEntryBaseType.pick('baseUrl').merge({ 'transport?': transportType }).readonly();
  const completionProviderEntryType = llmCompletionProviderEntryType
    .merge({
      'transport?': transportType,
      'metering?': type.enumerated(...config.meterings),
      'decision?': type.enumerated(...config.decisionRoutes)
    })
    .readonly();

  return { providerEntryBaseType, completionProviderEntryType };
}

/**
 * The per-schema entry checks {@link makeLlmModelConfigEntryTypes} builds.
 */
export type LlmModelConfigEntryTypes = ReturnType<typeof makeLlmModelConfigEntryTypes>;
