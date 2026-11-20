/**
 * The MODEL / OUTPUT-BUDGET / PROVIDER **precedence ladders** — the ONE resolution both a dispatcher (which spends the
 * call) and a report (which explains what a call would spend) read, so what a report shows can never drift from what
 * the wire actually carries. A second hand-rolled copy of a six-branch precedence is exactly the drift one shared copy
 * prevents.
 *
 * Every resolver names the rung that won (`source`). A dispatcher discards it; only a reporting surface needs to
 * explain the resolution. A dispatcher may layer its own rules on top (for example threading `undefined` whenever the
 * resolved model equals the default-tier model, so the common path stays byte-identical).
 *
 * A true LEAF: it imports only the value types and the sibling tier / routing modules, and takes the capability
 * descriptor STRUCTURALLY ({@link LlmCapabilityModelRef}), so it never imports a capability registry.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmModelId, type LlmModelOutputControls, type LlmModelSelection, type LlmModelTierKey, type LlmReasoningConfig, type LlmStrategyId, type LlmTokenCount } from './llm.value';
import { toLlmTierConfig, resolveLlmModelTier, type LlmModelTierMap } from './llm.model.tier';
import { type LlmCapabilityRoute } from './llm.model.routing';
import { type LlmModelVisionMap } from './llm.model.wire';
import { type LlmModelProviderBindingMap } from './config/llm.model.config.resolve';

/**
 * The reasoning-OFF floor — `{ enabled: false }` disables a hybrid-reasoning model's thinking so a latency-critical
 * call does not silently burn hidden reasoning tokens. The usual bottom rung of the reasoning ladder; a host passes
 * another {@link ResolveLlmCapabilityOutputControlsConfig.reasoningDefault} to override it.
 */
export const LLM_REASONING_OFF: LlmReasoningConfig = { enabled: false };

/**
 * The capability fields the precedence reads — STRUCTURAL, so this leaf never imports a capability registry. A full
 * capability descriptor satisfies it as-is; an execute-only declaration satisfies it with just its `model`.
 *
 * Its `tier` is the preferred axis field (unset ⇒ the default tier) and its raw `model` slug the escape hatch (wins over
 * `tier`); its `maxOutputTokens` / `reasoning` win over the tier's. Composed of {@link LlmModelSelection} and
 * {@link LlmModelOutputControls}.
 */
export interface LlmCapabilityModelRef extends LlmModelSelection, LlmModelOutputControls {}

/**
 * Which rung of the model ladder WON — the attribution a report renders (`route` says a host routing rule overrode the
 * compiled-in default; `default-tier` says nothing configured this capability).
 */
export type LlmCapabilityModelSource = 'request-model' | 'request-tier' | 'route' | 'descriptor-model' | 'descriptor-tier' | 'default-tier';

/**
 * Which rung of the output-budget ladder supplied the `maxOutputTokens` (absent ⇒ nothing configured one, so the
 * strategy's own default cap applies).
 */
export type LlmCapabilityOutputBudgetSource = 'route' | 'descriptor' | 'tier';

/**
 * Which rung of the reasoning ladder supplied the resolved {@link LlmReasoningConfig} (`default` ⇒ the host floor,
 * usually {@link LLM_REASONING_OFF}).
 */
export type LlmCapabilityReasoningSource = 'request' | 'route' | 'descriptor' | 'tier' | 'default';

/**
 * The per-call model override — the highest-precedence rungs of the model ladder: a per-call raw `model` slug wins over
 * everything, a per-call `tier` over everything but that. A {@link LlmModelSelection}.
 */
export interface LlmCapabilityModelOverride extends LlmModelSelection {}

/**
 * The resolved MODEL axis for one capability — the CONCRETE model a call would burn plus the rung that chose it. Its
 * `model` is always the real slug, because a reporting surface must name the model rather than imply it. `tier` is the
 * named-tier key it resolved from, absent for a raw-slug resolution (a slug carries no tier).
 */
export interface LlmResolvedCapabilityModel extends Pick<LlmModelSelection, 'tier'> {
  /**
   * The concrete model slug the precedence resolved.
   */
  readonly model: LlmModelId;
  /**
   * Which rung won.
   */
  readonly source: LlmCapabilityModelSource;
}

/**
 * Config for {@link resolveLlmCapabilityModel}.
 */
export interface ResolveLlmCapabilityModelConfig {
  /**
   * The PER-CALL override — the highest-precedence rungs. Omitted (a static read, e.g. a report) ⇒ the ladder starts
   * at the host route.
   */
  readonly override?: Maybe<LlmCapabilityModelOverride>;
  /**
   * The capability's compiled-in defaults, structurally; absent for an unregistered capability.
   */
  readonly descriptor?: Maybe<LlmCapabilityModelRef>;
  /**
   * The capability's COMPILED host routing rule, when one matched it.
   */
  readonly route?: Maybe<LlmCapabilityRoute>;
  /**
   * The active tier map a tier key resolves against.
   */
  readonly tiers: LlmModelTierMap;
  /**
   * The default tier a tier-less, model-less capability routes to.
   */
  readonly defaultTier: LlmModelTierKey;
}

/**
 * Resolve the effective model and tier for one capability by the precedence: a per-call RAW slug > a per-call TIER >
 * a HOST routing rule > the capability's RAW slug > the capability's TIER > the default tier. A tier key that is not
 * in the map FAILS LOUD — including the default tier, which is resolved unconditionally so a bad default reddens
 * every path, not just the fall-through one.
 *
 * @param config - The per-call override, the descriptor ref, the host route, the tier map, and the default tier.
 * @returns The concrete model, the tier it resolved from (when any) and the winning rung.
 * @throws {Error} When a named tier is not present in `tiers`.
 */
export function resolveLlmCapabilityModel(config: ResolveLlmCapabilityModelConfig): LlmResolvedCapabilityModel {
  const { override, descriptor, route, tiers, defaultTier } = config;

  // Resolve the default tier FIRST (fail-loud on a bad key regardless of which rung ends up winning), then walk the
  // ladder top-down. A raw slug carries no tier attribution; a tier resolution records its key.
  let model: LlmModelId = resolveLlmModelTier(tiers, defaultTier);
  let tier: Maybe<LlmModelTierKey> = defaultTier;
  let source: LlmCapabilityModelSource = 'default-tier';

  if (override?.model != null) {
    model = override.model;
    tier = undefined;
    source = 'request-model';
  } else if (override?.tier != null) {
    model = resolveLlmModelTier(tiers, override.tier);
    tier = override.tier;
    source = 'request-tier';
  } else if (route != null) {
    // A host routing rule matched — its compiled route (already tier-resolved, fail-loud at startup) wins over the
    // capability's compiled-in defaults.
    model = route.model;
    tier = route.tier;
    source = 'route';
  } else if (descriptor?.model != null) {
    model = descriptor.model;
    tier = undefined;
    source = 'descriptor-model';
  } else if (descriptor?.tier != null) {
    model = resolveLlmModelTier(tiers, descriptor.tier);
    tier = descriptor.tier;
    source = 'descriptor-tier';
  }

  return { model, ...(tier == null ? {} : { tier }), source };
}

/**
 * A capability's billed slug and whether it can SEE — the ONE read of the per-slug `vision` fact
 * ({@link resolveLlmCapabilityVision}); `model` / `source` are the model ladder's.
 */
export interface LlmCapabilityVision {
  /**
   * The slug the model ladder resolved.
   */
  readonly model: LlmModelId;
  /**
   * `visionByModel[model] === true` — the same flag a strategy reads before it sends an attachment.
   */
  readonly vision: boolean;
  /**
   * Which rung of the model ladder won.
   */
  readonly source: LlmCapabilityModelSource;
}

/**
 * Config for {@link resolveLlmCapabilityVision}: the model ladder's inputs plus the per-slug vision map.
 */
export interface LlmCapabilityVisionConfig extends ResolveLlmCapabilityModelConfig {
  /**
   * The per-slug vision facts (`llmModelVisionCapabilities`); absent ⇒ nothing can see.
   */
  readonly visionByModel?: Maybe<LlmModelVisionMap>;
}

/**
 * THE ONE VISION READER — the slug {@link resolveLlmCapabilityModel} bills (the host-route rung included) and whether
 * that slug is declared `vision: true`. A caller that attaches images decides both the attachments and any prompt
 * marker from it, so the two cannot disagree.
 *
 * @param config - The ladder's inputs and the vision map.
 * @returns The billed slug, whether it sees, and the rung that chose it.
 */
export function resolveLlmCapabilityVision(config: LlmCapabilityVisionConfig): LlmCapabilityVision {
  const { model, source } = resolveLlmCapabilityModel(config);
  return { model, vision: config.visionByModel?.[model] === true, source };
}

/**
 * The resolved OUTPUT-BUDGET axis for one capability — the completion cap and reasoning controls a call would carry,
 * each with the rung that supplied it.
 */
export interface LlmResolvedCapabilityOutputControls {
  /**
   * The completion-length cap; absent ⇒ nothing configured one, so the strategy's own default cap applies.
   */
  readonly maxOutputTokens?: LlmTokenCount;
  /**
   * Which rung supplied {@link maxOutputTokens}; absent exactly when it is.
   */
  readonly maxOutputTokensSource?: LlmCapabilityOutputBudgetSource;
  /**
   * The resolved reasoning controls — ALWAYS present (the bottom rung is the host floor).
   */
  readonly reasoning: LlmReasoningConfig;
  /**
   * Which rung supplied {@link reasoning}.
   */
  readonly reasoningSource: LlmCapabilityReasoningSource;
}

/**
 * Config for {@link resolveLlmCapabilityOutputControls}.
 */
export interface ResolveLlmCapabilityOutputControlsConfig {
  /**
   * The capability's compiled-in defaults, structurally.
   */
  readonly descriptor?: Maybe<LlmCapabilityModelRef>;
  /**
   * The capability's COMPILED host routing rule, when one matched.
   */
  readonly route?: Maybe<LlmCapabilityRoute>;
  /**
   * The tier KEY the model resolved from ({@link LlmResolvedCapabilityModel.tier}), or absent for a raw-slug
   * resolution (a raw slug reads no tier config).
   */
  readonly tier: Maybe<LlmModelTierKey>;
  /**
   * The active tier map the tier's own output controls are read from.
   */
  readonly tiers: LlmModelTierMap;
  /**
   * The host's reasoning floor ({@link LLM_REASONING_OFF} unless the host overrides it) — the bottom rung.
   */
  readonly reasoningDefault: LlmReasoningConfig;
  /**
   * The PER-CALL reasoning override — the top rung. Omitted (a static read) ⇒ the ladder starts at the host route.
   */
  readonly requestReasoning?: Maybe<LlmReasoningConfig>;
}

/**
 * Resolve the effective output controls for one capability. `maxOutputTokens` follows **route > descriptor > the
 * resolved tier's config**, omitted when none configures it; `reasoning` follows **request > route > descriptor > the
 * resolved tier's config > the host floor** and is always resolved. A raw-slug resolution (no tier) reads no tier
 * config but still gets the request / route / descriptor / floor rungs.
 *
 * @param config - The descriptor ref, the host route, the resolved tier key, the tier map, the reasoning floor, and
 *   the per-call reasoning override.
 * @returns The resolved cap and reasoning, each with its winning rung.
 */
export function resolveLlmCapabilityOutputControls(config: ResolveLlmCapabilityOutputControlsConfig): LlmResolvedCapabilityOutputControls {
  const { descriptor, route, tier, tiers, reasoningDefault, requestReasoning } = config;
  const tierValue = tier == null ? undefined : tiers[tier];
  const tierConfig = tierValue == null ? undefined : toLlmTierConfig(tierValue);
  // A host routing rule's explicit output controls slot ABOVE the descriptor's (the rule is the more specific host
  // intent) but below a per-call reasoning override; a rule without them changes nothing here.
  let maxOutputTokens: Maybe<LlmTokenCount>;
  let maxOutputTokensSource: Maybe<LlmCapabilityOutputBudgetSource>;

  if (route?.maxOutputTokens != null) {
    maxOutputTokens = route.maxOutputTokens;
    maxOutputTokensSource = 'route';
  } else if (descriptor?.maxOutputTokens != null) {
    maxOutputTokens = descriptor.maxOutputTokens;
    maxOutputTokensSource = 'descriptor';
  } else if (tierConfig?.maxOutputTokens != null) {
    maxOutputTokens = tierConfig.maxOutputTokens;
    maxOutputTokensSource = 'tier';
  }

  let reasoning: LlmReasoningConfig = reasoningDefault;
  let reasoningSource: LlmCapabilityReasoningSource = 'default';

  if (requestReasoning != null) {
    reasoning = requestReasoning;
    reasoningSource = 'request';
  } else if (route?.reasoning != null) {
    reasoning = route.reasoning;
    reasoningSource = 'route';
  } else if (descriptor?.reasoning != null) {
    reasoning = descriptor.reasoning;
    reasoningSource = 'descriptor';
  } else if (tierConfig?.reasoning != null) {
    reasoning = tierConfig.reasoning;
    reasoningSource = 'tier';
  }

  return { ...(maxOutputTokens == null || maxOutputTokensSource == null ? {} : { maxOutputTokens, maxOutputTokensSource }), reasoning, reasoningSource };
}

/**
 * Which rung of the provider ladder supplied the provider.
 */
export type LlmCapabilityProviderSource = 'route' | 'model-binding' | 'default';

/**
 * The resolved PROVIDER axis for one call — the provider (strategy instance id) it is served by, and why.
 */
export interface LlmResolvedCapabilityProvider {
  /**
   * The provider the call is served by.
   */
  readonly provider: LlmStrategyId;
  /**
   * Which rung won.
   */
  readonly source: LlmCapabilityProviderSource;
}

/**
 * Config for {@link resolveLlmCapabilityProvider}.
 */
export interface ResolveLlmCapabilityProviderConfig {
  /**
   * The capability's COMPILED host routing rule, when one matched (only its `provider` is read).
   */
  readonly route?: Maybe<Pick<LlmCapabilityRoute, 'provider'>>;
  /**
   * The RESOLVED concrete slug ({@link LlmResolvedCapabilityModel.model}).
   */
  readonly model: LlmModelId;
  /**
   * The per-slug provider bindings (`llmModelProviderBindings`).
   */
  readonly bindings?: Maybe<LlmModelProviderBindingMap>;
  /**
   * The host's default provider. Required: the library mints no default provider instance of its own.
   */
  readonly defaultProvider: LlmStrategyId;
}

/**
 * Resolve the provider one call is served by: the route's provider > the resolved slug's binding > the host default.
 *
 * The route is a host POLICY ("send the support family to the local box") and the binding a slug ENTITLEMENT ("this
 * slug is only reachable on that key"); the policy is the more specific statement about this call, so it wins. The
 * binding is read AFTER the model resolves because entitlement lives on the slug however it was selected — a per-call
 * slug, a route, a capability default or a tier.
 *
 * @param config - The route, the resolved slug, the bindings and the default provider.
 * @returns The provider and the rung that chose it.
 */
export function resolveLlmCapabilityProvider(config: ResolveLlmCapabilityProviderConfig): LlmResolvedCapabilityProvider {
  const { route, model, bindings, defaultProvider } = config;
  const routeProvider = route?.provider;
  const boundProvider = bindings?.[model];
  let result: LlmResolvedCapabilityProvider;

  if (routeProvider != null) {
    result = { provider: routeProvider, source: 'route' };
  } else if (boundProvider == null) {
    result = { provider: defaultProvider, source: 'default' };
  } else {
    result = { provider: boundProvider, source: 'model-binding' };
  }

  return result;
}
