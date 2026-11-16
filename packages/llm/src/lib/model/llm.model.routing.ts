/**
 * The **per-capability model routing** block — the host-facing configuration that maps capabilities (by key or by
 * {@link LlmCapabilityTag}) onto named tiers or raw model slugs, so a host mixes models per task ("route the `dialog`
 * family to `vendor/character-voice`") without touching code. It generalizes a capability's compiled-in defaults
 * (its own `tier` / `model`): a matched rule wins OVER those defaults but stays BELOW a per-call override (intentional
 * call-site logic).
 *
 * **Fail-loud, no silent fallback.** {@link compileLlmModelRouting} validates every rule at startup: an unknown
 * capability key, a tag no capability carries, an unknown tier key, an unknown PROVIDER name, or a rule naming neither
 * `tier` nor `model` each throw — a typo'd config reddens the boot, never silently routes to the default tier (or,
 * worse, to the default provider's key).
 *
 * A rule may also name the declared PROVIDER its matched calls are served by ({@link LlmModelRoutingRule.provider}) —
 * the per-CAPABILITY half of the multi-provider axis: a slug's provider binding states an ENTITLEMENT, and a rule
 * states a host POLICY over it.
 *
 * Leaf module: it imports only the tier registry and the value types, and takes capabilities STRUCTURALLY
 * (`{ capability, tags? }`), so it never imports a capability descriptor registry; the host that owns one feeds it in.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCapabilityKey, type LlmCapabilityTag, type LlmModelId, type LlmModelTierKey, type LlmReasoningConfig, type LlmStrategyId } from './llm.value';
import { resolveLlmModelTier, type LlmModelTierMap, type LlmPartialModelTierMap } from './llm.model.tier';

/**
 * The default error-message prefix of {@link compileLlmModelRouting} (`llm model routing rule #2: …`).
 */
export const DEFAULT_LLM_MODEL_ROUTING_LABEL = 'llm model routing';

/**
 * One host-declared routing rule — targets (by capability key and/or tag) plus the route (a named `tier` or a raw
 * `model` slug, with optional per-rule output controls). At least one target field AND at least one of `tier` /
 * `model` must be set (validated fail-loud by {@link compileLlmModelRouting}); `model` wins when both are set (an
 * explicit slug is the more specific intent, as a capability's own slug wins over its own tier).
 */
export interface LlmModelRoutingRule {
  /**
   * The exact capability keys this rule targets (e.g. `["reply-line"]`). A capability-key match beats any tag match,
   * regardless of rule order.
   */
  readonly capabilities?: ReadonlyArray<LlmCapabilityKey>;
  /**
   * The capability tags this rule targets (e.g. `["dialog"]` for a whole family). Within the tag level, the FIRST
   * matching rule wins (array order = priority).
   */
  readonly tags?: ReadonlyArray<LlmCapabilityTag>;
  /**
   * The named tier to route matched capabilities to — resolved against the active tier map (fail-loud on an unknown
   * key). Superseded by {@link model} when both are set.
   */
  readonly tier?: LlmModelTierKey;
  /**
   * A raw model slug to route matched capabilities to (e.g. `"vendor/character-voice"`) — the escape hatch that
   * bypasses the tier registry. Wins over {@link tier} when both are set.
   */
  readonly model?: LlmModelId;
  /**
   * The declared PROVIDER this rule's calls are served by — a provider name from the host's model config (validated
   * fail-loud by {@link compileLlmModelRouting} against the names the host passes).
   *
   * NARROWER than a slug's provider binding, and that ordering is deliberate: the binding states an entitlement
   * ("this slug is only reachable on that key"), while a rule states a POLICY ("send the dialog family to the local
   * box"). Policy wins because a host that has said where a capability should run has said something more specific
   * about this call than the slug's default home is.
   *
   * Omitted ⇒ the slug's binding, else the host's default provider.
   */
  readonly provider?: LlmStrategyId;
  /**
   * An optional per-rule completion-length cap — wins over the capability's own `maxOutputTokens` (which in turn wins
   * over the routed tier's). Omitted ⇒ the capability / tier / strategy default.
   */
  readonly maxOutputTokens?: number;
  /**
   * Optional per-rule reasoning controls — win over the capability's own `reasoning` (a per-call reasoning override
   * still wins over everything). Omitted ⇒ the capability / tier / host floor.
   */
  readonly reasoning?: LlmReasoningConfig;
}

/**
 * The host-facing routing block — extra named tiers, an optional default-tier switch, and the ordered rule list.
 */
export interface LlmModelRoutingConfig {
  /**
   * Extra named tiers merged OVER the host's tier map (a bare slug or a rich `{ model, maxOutputTokens?, reasoning? }`
   * config), so a rule can name a tier declared right beside it (`{ "dialog": "vendor/character-voice" }`). The
   * CALLER merges them (`resolveLlmModelTiers`) before compiling.
   */
  readonly tiers?: LlmPartialModelTierMap;
  /**
   * Which tier is the DEFAULT (the model a tier-less, rule-less call routes to). Omitted ⇒ the host's default.
   */
  readonly defaultTier?: LlmModelTierKey;
  /**
   * The ordered routing rules. Capability-key matches beat tag matches; within a level, the first matching rule wins.
   */
  readonly rules?: ReadonlyArray<LlmModelRoutingRule>;
}

/**
 * One COMPILED route — the per-capability resolution {@link compileLlmModelRouting} pre-computes so a dispatcher does
 * a single map lookup per call. `model` is always concrete (a tier rule resolves at compile, fail-loud); `tier`
 * carries the named-tier KEY when the rule routed through one (telemetry attribution and the tier's own output-control
 * config), and is absent for a raw-slug rule.
 */
export interface LlmCapabilityRoute {
  /**
   * The concrete model slug the matched rule routes this capability to.
   */
  readonly model: LlmModelId;
  /**
   * The named-tier key the model resolved from, when the rule named a tier (absent for a raw-slug rule).
   */
  readonly tier?: LlmModelTierKey;
  /**
   * The declared provider the matched rule binds this capability's calls to, when it named one.
   */
  readonly provider?: LlmStrategyId;
  /**
   * The rule's completion-length cap, when it declared one.
   */
  readonly maxOutputTokens?: number;
  /**
   * The rule's reasoning controls, when it declared them.
   */
  readonly reasoning?: LlmReasoningConfig;
}

/**
 * The compiled capability → route map a dispatcher consults (one lookup per call).
 */
export type LlmCompiledModelRouting = ReadonlyMap<LlmCapabilityKey, LlmCapabilityRoute>;

/**
 * The capability view {@link compileLlmModelRouting} validates and matches against — structural (key + tags), so this
 * leaf module never imports a capability registry.
 */
export interface LlmModelRoutingCapabilityRef {
  /**
   * The capability key.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The capability's declared tags, when any.
   */
  readonly tags?: ReadonlyArray<LlmCapabilityTag>;
}

/**
 * Config for {@link compileLlmModelRouting}.
 */
export interface CompileLlmModelRoutingConfig {
  /**
   * The host's routing block. Its `tiers` should ALREADY be merged into {@link tiers} by the caller
   * (`resolveLlmModelTiers`).
   */
  readonly routing: LlmModelRoutingConfig;
  /**
   * The known capability refs (key + tags), passed structurally.
   */
  readonly capabilities: ReadonlyArray<LlmModelRoutingCapabilityRef>;
  /**
   * The COMPLETE active tier map a rule's `tier` resolves against.
   */
  readonly tiers: LlmModelTierMap;
  /**
   * The declared PROVIDER names a rule's `provider` may reference — the host's resolved provider set. Omitted ⇒
   * provider validation is SKIPPED, which is what a caller with no provider layer at all (a unit spec, a host with one
   * backend) wants; passing an EMPTY array is the different, stricter statement that no provider may be named.
   */
  readonly providers?: Maybe<ReadonlyArray<LlmStrategyId>>;
  /**
   * The error-message prefix. Default {@link DEFAULT_LLM_MODEL_ROUTING_LABEL}.
   */
  readonly label?: Maybe<string>;
}

/**
 * One rule, validated and pre-resolved.
 */
interface LlmResolvedModelRoutingRule {
  readonly rule: LlmModelRoutingRule;
  readonly route: LlmCapabilityRoute;
}

/**
 * Compile a host routing block into the per-capability route map — validated FAIL-LOUD (an unknown capability key,
 * tag, tier key or provider, and a target-less or route-less rule each throw at startup), with the precedence
 * pre-applied: a rule that names a capability key beats any tag-matching rule; within each level the first matching
 * rule (array order) wins.
 *
 * @param config - The routing block, the known capability refs, the active tier map, and (optionally) the declared
 *   provider names and the error label.
 * @returns The compiled capability → route map (empty when the block declares no rules).
 * @throws {Error} When a rule references an unknown capability / tag / tier / provider, or declares no target or no
 *   route.
 */
export function compileLlmModelRouting(config: CompileLlmModelRoutingConfig): LlmCompiledModelRouting {
  const { routing, capabilities, tiers, providers } = config;
  const labelPrefix = config.label ?? DEFAULT_LLM_MODEL_ROUTING_LABEL;
  const rules = routing.rules ?? [];
  const routes = new Map<LlmCapabilityKey, LlmCapabilityRoute>();

  if (rules.length > 0) {
    const knownCapabilities = new Set(capabilities.map((ref) => ref.capability));
    const knownTags = new Set(capabilities.flatMap((ref) => ref.tags ?? []));

    // Validate and pre-resolve every rule once (fail-loud), independent of whether anything matches it.
    const resolvedRules = rules.map((rule, index): LlmResolvedModelRoutingRule => {
      const label = `${labelPrefix} rule #${index + 1}`;

      if ((rule.capabilities == null || rule.capabilities.length === 0) && (rule.tags == null || rule.tags.length === 0)) {
        throw new Error(`${label}: declares no target; set 'capabilities' and/or 'tags'.`);
      }

      if (rule.model == null && rule.tier == null) {
        throw new Error(`${label}: declares no route; set 'tier' or 'model'.`);
      }

      for (const capability of rule.capabilities ?? []) {
        if (!knownCapabilities.has(capability)) {
          throw new Error(`${label}: unknown capability '${capability}'.`);
        }
      }

      for (const tag of rule.tags ?? []) {
        if (!knownTags.has(tag)) {
          throw new Error(`${label}: no capability carries the tag '${tag}' (have: ${Array.from(knownTags).join(', ') || 'none'}).`);
        }
      }

      // A provider name is validated only when the caller declared the provider set — see
      // `CompileLlmModelRoutingConfig.providers` for why an ABSENT set skips rather than rejects. Fail-loud when it is
      // declared: a typo'd provider silently served from the default one is a run billing the wrong account.
      if (rule.provider != null && providers != null && !providers.includes(rule.provider)) {
        throw new Error(`${label}: unknown provider '${rule.provider}' (have: ${providers.join(', ') || 'none'}).`);
      }

      // A raw slug wins over a tier (the capability-slug-over-tier precedent); a tier resolves fail-loud NOW.
      const shared = { ...(rule.provider == null ? {} : { provider: rule.provider }), ...(rule.maxOutputTokens == null ? {} : { maxOutputTokens: rule.maxOutputTokens }), ...(rule.reasoning == null ? {} : { reasoning: rule.reasoning }) };
      const route: LlmCapabilityRoute = rule.model == null ? { model: resolveLlmModelTier(tiers, rule.tier as LlmModelTierKey), tier: rule.tier as LlmModelTierKey, ...shared } : { model: rule.model, ...shared };
      return { rule, route };
    });

    // Resolve each known capability against the rules: the capability-key level first, then the tag level.
    for (const ref of capabilities) {
      const byCapability = resolvedRules.find(({ rule }) => rule.capabilities?.includes(ref.capability));
      const match = byCapability ?? (ref.tags == null || ref.tags.length === 0 ? undefined : resolvedRules.find(({ rule }) => rule.tags?.some((tag) => ref.tags?.includes(tag))));

      if (match != null) {
        routes.set(ref.capability, match.route);
      }
    }
  }

  return routes;
}
