/**
 * The **per-capability model routing** block — the host-facing configuration that maps capabilities (by key or by
 * {@link LlmCapabilityTag}) onto named tiers or raw model slugs, so a host mixes models per task ("route the `support`
 * family to `vendor/model-chat`") without touching code. It generalizes a capability's compiled-in defaults
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

import { type ArktypeFieldRules, assertObjectKeys, parseArktypeFieldsWithMessages, schemaLabelMessagePrefix } from '@dereekb/model';
import { filterUndefinedValues, isPlainObject, type Maybe } from '@dereekb/util';
import { ArkErrors } from 'arktype';
import { LLM_MODEL_OUTPUT_CONTROLS_FIELD_RULES, LLM_MODEL_OUTPUT_CONTROLS_KEYS, LLM_MODEL_PROVIDER_REF_FIELD_RULES, LLM_MODEL_PROVIDER_REF_KEYS, LLM_MODEL_SELECTION_FIELD_RULES, LLM_MODEL_SELECTION_KEYS, toCanonicalLlmModelOutputControls } from './llm.model.field';
import { compileLlmCapabilityRules, type LlmModelRoutingCapabilityRef } from './llm.capability.rule';
import { resolveLlmModelTier, type LlmModelTierMap, type LlmPartialModelTierMap } from './llm.model.tier';
import { parseLlmModelTierMap } from './llm.model.tier.parse';
import { llmModelRoutingRuleType, llmModelTierKeyType } from './llm.model.type';
import { type LlmCapabilityKey, type LlmCapabilityTag, type LlmModelId, type LlmModelOutputControls, type LlmModelProviderRef, type LlmModelSelection, type LlmModelTierKey, type LlmStrategyId } from './llm.value';

/**
 * The default error-message prefix of {@link compileLlmModelRouting} (`llm model routing rule #2: …`).
 */
export const DEFAULT_LLM_MODEL_ROUTING_LABEL = 'llm model routing';

/**
 * One host-declared routing rule — targets (by capability key and/or tag) plus the route (a named `tier` or a raw
 * `model` slug, with optional per-rule output controls). At least one target field AND at least one of `tier` /
 * `model` must be set (validated fail-loud by {@link compileLlmModelRouting}); `model` wins when both are set (an
 * explicit slug is the more specific intent, as a capability's own slug wins over its own tier).
 *
 * `provider` names the declared PROVIDER this rule's calls are served by (validated fail-loud by
 * {@link compileLlmModelRouting} against the names the host passes). It is NARROWER than a slug's provider binding, and
 * deliberately so: the binding states an entitlement ("this slug is only reachable on that key"), while a rule states a
 * POLICY ("send the support family to the local box"). Omitted ⇒ the slug's binding, else the host's default provider.
 *
 * `maxOutputTokens` / `reasoning` win over the capability's own (which win over the routed tier's); a per-call
 * reasoning override still wins over everything.
 *
 * Derived from {@link llmModelRoutingRuleType}: its targets plus {@link LlmModelSelection}, {@link LlmModelProviderRef}
 * and {@link LlmModelOutputControls}.
 */
export interface LlmModelRoutingRule extends Readonly<typeof llmModelRoutingRuleType.infer> {}

/**
 * The host-facing routing block — extra named tiers, an optional default-tier switch, and the ordered rule list.
 */
export interface LlmModelRoutingConfig {
  /**
   * Extra named tiers merged OVER the host's tier map (a bare slug or a rich `{ model, maxOutputTokens?, reasoning? }`
   * config), so a rule can name a tier declared right beside it (`{ "support": "vendor/model-chat" }`). The
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

// MARK: Parse
/**
 * The keys a routing block may carry, in canonical order — an unknown one fails loud.
 */
export const LLM_MODEL_ROUTING_CONFIG_KEYS = ['tiers', 'defaultTier', 'rules'] as const satisfies ReadonlyArray<keyof LlmModelRoutingConfig>;

/**
 * The keys a routing rule may carry, in canonical (output and message) order — an unknown one fails loud.
 */
export const LLM_MODEL_ROUTING_RULE_KEYS = ['capabilities', 'tags', ...LLM_MODEL_SELECTION_KEYS, ...LLM_MODEL_PROVIDER_REF_KEYS, ...LLM_MODEL_OUTPUT_CONTROLS_KEYS] as const satisfies ReadonlyArray<keyof LlmModelRoutingRule>;

/**
 * The messages for a routing rule's fields.
 */
export const LLM_MODEL_ROUTING_RULE_FIELD_RULES: ArktypeFieldRules<LlmModelRoutingRule> = {
  capabilities: { must: 'be an array of capability keys' },
  tags: { must: 'be an array of capability tags' },
  ...LLM_MODEL_SELECTION_FIELD_RULES,
  ...LLM_MODEL_PROVIDER_REF_FIELD_RULES,
  ...LLM_MODEL_OUTPUT_CONTROLS_FIELD_RULES
};

/**
 * Config for {@link parseLlmModelRoutingConfig}.
 */
export interface ParseLlmModelRoutingConfigConfig {
  /**
   * The raw, JSON-decoded routing block.
   */
  readonly raw: unknown;
  /**
   * What the messages name as the block's surface (a file name, `routing.json`).
   */
  readonly source: string;
  /**
   * The message prefix. Default {@link DEFAULT_LLM_MODEL_ROUTING_LABEL}.
   */
  readonly label?: Maybe<string>;
}

/**
 * Parse and validate ONE routing rule.
 *
 * @param input - The labels, the rule's index and the raw rule.
 * @returns The rule, re-assembled in {@link LLM_MODEL_ROUTING_RULE_KEYS} order.
 * @throws {Error} When the rule is not an object, carries an unknown key, or a field has the wrong shape.
 */
function parseLlmModelRoutingRule(input: { readonly schemaLabel: string; readonly label: string; readonly value: unknown }): LlmModelRoutingRule {
  const { schemaLabel, label, value } = input;

  if (!isPlainObject(value)) {
    throw new Error(`${schemaLabelMessagePrefix(schemaLabel)}${label} must be a JSON object of { ${LLM_MODEL_ROUTING_RULE_KEYS.map((key) => `${key}?`).join(', ')} } (got ${JSON.stringify(value)}).`);
  }

  assertObjectKeys({ schemaLabel, label, entry: value, allowed: LLM_MODEL_ROUTING_RULE_KEYS });
  const parsed = parseArktypeFieldsWithMessages({ schemaLabel, label, value, type: llmModelRoutingRuleType, keys: LLM_MODEL_ROUTING_RULE_KEYS, rules: LLM_MODEL_ROUTING_RULE_FIELD_RULES });
  const { capabilities, tags, model, tier, provider } = parsed;

  return {
    ...(capabilities == null ? {} : { capabilities: [...capabilities] }),
    ...(tags == null ? {} : { tags: [...tags] }),
    ...(model == null ? {} : { model }),
    ...(tier == null ? {} : { tier: tier.trim() }),
    ...(provider == null ? {} : { provider: provider.trim() }),
    ...toCanonicalLlmModelOutputControls(parsed)
  };
}

/**
 * Parse and validate a raw routing block (already JSON-decoded by the host) — the SHAPE half of the fail-loud routing
 * check: an unknown key at any level, a `tiers` value the tier parser rejects, a blank `defaultTier`, a non-array
 * `rules`, and a rule field of the wrong shape (`"tags": "support"`, `"maxOutputTokens": "9000"` or `1.5`, a malformed
 * `reasoning`) each throw, naming the field (`llm model routing: models.json routing rules[2].tags must …`).
 *
 * The NAME half — unknown capability keys, tags, tiers and providers, and a rule with no target or no route — stays
 * with {@link compileLlmModelRouting}, which knows the host's capabilities, tiers and providers.
 *
 * @param config - The raw block, its source label and the message prefix.
 * @returns The validated block, rules re-assembled in canonical key order.
 * @throws {Error} When the block does not have the routing shape.
 */
export function parseLlmModelRoutingConfig(config: ParseLlmModelRoutingConfigConfig): LlmModelRoutingConfig {
  const { raw, source } = config;
  const schemaLabel = config.label ?? DEFAULT_LLM_MODEL_ROUTING_LABEL;
  const prefix = schemaLabelMessagePrefix(schemaLabel);

  if (!isPlainObject(raw)) {
    throw new Error(`${prefix}${source} must be a JSON object of { ${LLM_MODEL_ROUTING_CONFIG_KEYS.map((key) => `${key}?`).join(', ')} }.`);
  }

  assertObjectKeys({ schemaLabel, label: source, entry: raw, allowed: LLM_MODEL_ROUTING_CONFIG_KEYS });

  const rawTiers = raw['tiers'];
  const tiers = rawTiers === undefined ? undefined : parseLlmModelTierMap({ schemaLabel, label: `${source}.tiers`, value: rawTiers });
  const rawDefaultTier = raw['defaultTier'];
  let defaultTier: Maybe<LlmModelTierKey>;

  if (rawDefaultTier !== undefined) {
    const checked = llmModelTierKeyType(rawDefaultTier);

    if (checked instanceof ArkErrors) {
      throw new TypeError(`${prefix}${source}.defaultTier must be a non-blank tier key (got ${JSON.stringify(rawDefaultTier)}).`);
    }

    defaultTier = checked.trim();
  }

  const rawRules = raw['rules'];

  if (rawRules !== undefined && !Array.isArray(rawRules)) {
    throw new Error(`${prefix}${source}.rules must be an array of routing rules (got ${JSON.stringify(rawRules)}).`);
  }

  const rules = rawRules?.map((value, index) => parseLlmModelRoutingRule({ schemaLabel, label: `${source} rules[${index}]`, value }));
  const routing: { readonly [K in (typeof LLM_MODEL_ROUTING_CONFIG_KEYS)[number]]: LlmModelRoutingConfig[K] } = { tiers, defaultTier: defaultTier ?? undefined, rules };
  return filterUndefinedValues(routing);
}

/**
 * One COMPILED route — the per-capability resolution {@link compileLlmModelRouting} pre-computes so a dispatcher does
 * a single map lookup per call. `model` is always concrete (a tier rule resolves at compile, fail-loud); `tier`
 * carries the named-tier KEY when the rule routed through one (telemetry attribution and the tier's own output-control
 * config), and is absent for a raw-slug rule. `provider` / `maxOutputTokens` / `reasoning` are the rule's, when it
 * declared them.
 */
export interface LlmCapabilityRoute extends Pick<LlmModelSelection, 'tier'>, LlmModelProviderRef, LlmModelOutputControls {
  /**
   * The concrete model slug the matched rule routes this capability to.
   */
  readonly model: LlmModelId;
}

/**
 * The compiled capability → route map a dispatcher consults (one lookup per call).
 */
export type LlmCompiledModelRouting = ReadonlyMap<LlmCapabilityKey, LlmCapabilityRoute>;

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

  return compileLlmCapabilityRules<LlmModelRoutingRule, LlmCapabilityRoute>({
    rules: routing.rules,
    capabilities,
    label: config.label ?? DEFAULT_LLM_MODEL_ROUTING_LABEL,
    validateRule: (rule, { label }) => {
      if (rule.model == null && rule.tier == null) {
        throw new Error(`${label}: declares no route; set 'tier' or 'model'.`);
      }
    },
    readValue: (rule, { label }) => {
      // A provider name is validated only when the caller declared the provider set — see
      // `CompileLlmModelRoutingConfig.providers` for why an ABSENT set skips rather than rejects. Fail-loud when it is
      // declared: a typo'd provider silently served from the default one is a run billing the wrong account.
      if (rule.provider != null && providers != null && !providers.includes(rule.provider)) {
        throw new Error(`${label}: unknown provider '${rule.provider}' (have: ${providers.join(', ') || 'none'}).`);
      }

      // A raw slug wins over a tier (the capability-slug-over-tier precedent); a tier resolves fail-loud NOW.
      const shared = filterUndefinedValues({ provider: rule.provider, maxOutputTokens: rule.maxOutputTokens, reasoning: rule.reasoning });
      const route: LlmCapabilityRoute = rule.model == null ? { model: resolveLlmModelTier(tiers, rule.tier as LlmModelTierKey), tier: rule.tier as LlmModelTierKey, ...shared } : { model: rule.model, ...shared };
      return route;
    }
  });
}
