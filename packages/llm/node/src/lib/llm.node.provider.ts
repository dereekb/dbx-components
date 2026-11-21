/**
 * **Providers from the environment** — which completion providers a run holds, which one a binding-less call routes
 * to, and which declared providers have no key.
 *
 * Two sources feed one ordered list: the env DEFAULTS ({@link LlmEnvNames.providers} — a bare vendor key on a fresh
 * machine is enough) and the DECLARED providers of the effective model config file, each keyed by the variable its
 * `apiKeyEnv` names. A declared provider with no key is a GAP and resolves to nothing: it is never re-pointed at
 * another provider's key. That substitution is the one harmful option — the slugs bound to a provider are usually
 * precisely the ones another key is not entitled to, so the run would die several calls later with a message about the
 * MODEL that sends the operator hunting the wrong thing.
 *
 * Reporting a gap rather than throwing keeps a missing key inert instead of failing a config read that runs on every
 * boot; a host makes the gap loud where loudness belongs (a readiness check, a startup line), scoped to the slugs the
 * run can reach with {@link filterLlmReachableProviderGaps}.
 */

import { concatArraysUnique, isEnvFlagEnabled, type Maybe } from '@dereekb/util';
import {
  isLlmTokenLimitParam,
  findLlmAdapter,
  type LlmAdapterRegistry,
  type LlmModelConfigBaseTypes,
  type LlmModelConfigFile,
  type LlmModelConfigSchema,
  type LlmModelConfigTypes,
  type LlmModelId,
  type LlmModelProviderBindingMap,
  type LlmModelRoutingConfig,
  type LlmPartialModelTierMap,
  type LlmProviderConfigGap,
  type LlmExtendedProviderConfig,
  type LlmProviderStrategyOptions,
  type LlmStrategyId,
  type LlmStrategyRegistry,
  readLlmTierModel,
  makeLlmProviderStrategies,
  makeLlmStrategyRegistry,
  parseLlmReasoningOffEncoding,
  resolveLlmProviderConfigs
} from '@dereekb/llm';
import { DEFAULT_LLM_ENV_NAMES, firstLlmEnvEntry, firstLlmEnvValue, type LlmEnvEntry, type LlmEnvNames, type LlmEnvProviderNames, type LlmEnvVarNames, type LlmEnvView } from './llm.node.env';

// MARK: Resolve
/**
 * Config for {@link resolveLlmProvidersFromEnv}.
 */
export interface ResolveLlmProvidersFromEnvConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The environment to read. Default `process.env`.
   */
  readonly env?: Maybe<LlmEnvView>;
  /**
   * The env names. Default {@link DEFAULT_LLM_ENV_NAMES}.
   */
  readonly names?: Maybe<LlmEnvNames>;
  /**
   * The EFFECTIVE model config (`loadEffectiveLlmModelConfigFile`); its `providers` block is the declared set.
   */
  readonly file?: Maybe<LlmModelConfigFile<X>>;
  /**
   * The schema — drops the entries of transports the extension owns (they serve no completions).
   */
  readonly schema: LlmModelConfigSchema<X>;
  /**
   * The registered adapters. An env default whose transport has no completion adapter is skipped.
   */
  readonly adapters: LlmAdapterRegistry;
  /**
   * Stored keys (a settings file) keyed by the env var they stand in for. Read only when the environment leaves that
   * key blank, for env defaults and declared providers alike — so a declared provider naming the var reaches the stored
   * key too, not only the default instance.
   */
  readonly fallbackKeys?: Maybe<LlmEnvView>;
}

/**
 * The providers an environment resolves.
 */
export interface LlmProvidersFromEnv<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The keyed providers, in resolution order: the non-fallback env defaults, the declared providers in declaration
   * order, then the fallback env defaults.
   */
  readonly providers: ReadonlyArray<LlmExtendedProviderConfig<X>>;
  /**
   * EVERY declared completion provider with no key, in declaration order. Unscoped: scope them to the slugs a run can
   * reach with {@link filterLlmReachableProviderGaps}.
   */
  readonly gaps: ReadonlyArray<LlmProviderConfigGap>;
  /**
   * The recognized explicit default-provider selection, when one was made.
   */
  readonly explicitProviderId?: LlmStrategyId;
  /**
   * Where a binding-less call routes — the dispatcher's default provider. Concrete whenever a fallback env default is
   * registered, keyed or not, so the first call fails loud at the credential rather than at an unknown id.
   */
  readonly defaultProviderId?: LlmStrategyId;
  /**
   * The keyed provider a single-provider caller (a test lane, a probe) uses: the default when it is keyed, else the
   * first keyed provider.
   */
  readonly defaultProvider?: LlmExtendedProviderConfig<X>;
}

/**
 * Resolve every completion provider a run holds — the env defaults and the declared providers — and the default.
 *
 * - **Env defaults** mint only for a registered completion transport, under their own id, with the base URL,
 *   token-limit param, reasoning-off encoding and usage accounting their variables set (each absent when unset; the
 *   lenient knobs ignore junk). These knobs apply to their own env default only.
 * - **Declared providers** resolve through `resolveLlmProviderConfigs`, keyed by their `apiKeyEnv`. A declared provider
 *   sharing an env default's id REPLACES it — keyed, it takes the slot; unkeyed, the slot stays empty and the provider
 *   is a gap. The env default never stands in for it.
 * - **The default**: an explicit selection (an exact match among the env-default and declared completion ids, else a
 *   case-insensitive match among the env-default ids; anything else THROWS — a typo, an env default whose adapter is
 *   not registered, a provider that serves no completions), else the first keyed
 *   non-fallback provider, else the fallback. An explicit selection adds no provider: when it names an unkeyed one,
 *   {@link LlmProvidersFromEnv.defaultProviderId} keeps it (a binding-less call fails loud at the credential) while
 *   {@link LlmProvidersFromEnv.defaultProvider} is the first keyed one.
 *
 * @param config - The environment, the env names, the effective file, the schema, the adapters and the stored keys.
 * @returns The keyed providers, the gaps and the default.
 * @throws {Error} When the default-provider variable names a provider this environment does not resolve.
 */
export function resolveLlmProvidersFromEnv<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ResolveLlmProvidersFromEnvConfig<X>): LlmProvidersFromEnv<X> {
  const { env, file, schema, adapters, fallbackKeys } = config;
  const names = config.names ?? DEFAULT_LLM_ENV_NAMES;
  const keyOf = (keyNames: LlmEnvVarNames): Maybe<LlmEnvEntry> => firstLlmEnvEntry({ env, names: keyNames }) ?? (fallbackKeys == null ? undefined : firstLlmEnvEntry({ env: fallbackKeys, names: keyNames }));

  const envDefaults = names.providers.filter((provider) => findLlmAdapter({ adapters, facet: 'completion', kind: provider.transport ?? provider.id }) != null);
  const envDefaultIds = new Set(envDefaults.map((provider) => provider.id));
  const declaredIds = new Set(Object.keys(file?.providers ?? {}));
  const declared = resolveLlmProviderConfigs({ providers: file?.providers, apiKeyOf: ({ entry }) => keyOf([entry.apiKeyEnv])?.value });
  // An env default carries none of the extension's provider fields — stated by spreading an empty `Partial` of them.
  const noExtensionFields: Partial<X['providerFields']> = {};

  const slotOf = (provider: LlmEnvProviderNames): Maybe<LlmExtendedProviderConfig<X>> => {
    let slot: Maybe<LlmExtendedProviderConfig<X>>;

    if (declaredIds.has(provider.id)) {
      slot = declared.providers.find((candidate) => candidate.id === provider.id);
    } else {
      const key = keyOf(provider.apiKey);

      if (key != null) {
        const baseUrl = firstLlmEnvValue({ env, names: provider.baseUrl ?? [] });
        const tokenLimitParam = firstLlmEnvValue({ env, names: provider.tokenLimitParam ?? [] })?.toLowerCase();
        const reasoningOff = parseLlmReasoningOffEncoding(firstLlmEnvValue({ env, names: provider.reasoningOff ?? [] }));
        const usageAccounting = isEnvFlagEnabled(firstLlmEnvValue({ env, names: provider.usageAccounting ?? [] }));

        slot = {
          id: provider.id,
          transport: provider.transport ?? provider.id,
          apiKey: key.value,
          apiKeyEnv: key.name,
          ...(baseUrl == null ? {} : { baseUrl }),
          ...(isLlmTokenLimitParam(tokenLimitParam) ? { tokenLimitParam } : {}),
          ...(reasoningOff == null ? {} : { reasoningOff }),
          ...(usageAccounting ? { usageAccounting: true } : {}),
          ...noExtensionFields
        };
      }
    }

    return slot;
  };

  const slotsOf = (fallback: boolean): LlmExtendedProviderConfig<X>[] => envDefaults.filter((provider) => (provider.fallback === true) === fallback).flatMap((provider) => slotOf(provider) ?? []);
  const primarySlots = slotsOf(false);
  const fallbackSlots = slotsOf(true);
  const declaredRest = declared.providers.filter((provider) => !envDefaultIds.has(provider.id));
  const providers = [...primarySlots, ...declaredRest, ...fallbackSlots];

  const requested = firstLlmEnvEntry({ env, names: names.defaultProvider });
  let explicitProviderId: Maybe<LlmStrategyId>;

  if (requested != null) {
    const { name, value } = requested;
    const lowered = value.toLowerCase();
    explicitProviderId = envDefaultIds.has(value) || declaredIds.has(value) ? value : envDefaults.find((provider) => provider.id.toLowerCase() === lowered)?.id;

    // A typo here would otherwise route every binding-less call to an inferred default — billing an account the
    // operator just tried to switch away from.
    if (explicitProviderId == null) {
      const ids = [...new Set([...envDefaultIds, ...declaredIds])];
      throw new Error(`${schema.label}: ${name} names provider '${value}', which this environment does not resolve (have: ${ids.length === 0 ? '(none)' : ids.join(', ')}).`);
    }
  }

  const defaultProviderId = explicitProviderId ?? [...primarySlots, ...declaredRest][0]?.id ?? fallbackSlots[0]?.id ?? envDefaults.find((provider) => provider.fallback === true)?.id;
  const defaultProvider = providers.find((provider) => provider.id === defaultProviderId) ?? providers[0];

  return {
    providers,
    gaps: declared.gaps,
    ...(explicitProviderId == null ? {} : { explicitProviderId }),
    ...(defaultProviderId == null ? {} : { defaultProviderId }),
    ...(defaultProvider == null ? {} : { defaultProvider })
  };
}

// MARK: Strategies
/**
 * Config for {@link makeLlmStrategiesFromEnv}: the resolver's inputs plus the options every strategy shares.
 */
export interface MakeLlmStrategiesFromEnvConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> extends ResolveLlmProvidersFromEnvConfig<X>, Omit<LlmProviderStrategyOptions, 'adapters'> {}

/**
 * The resolved providers and the strategies built for them.
 */
export interface LlmStrategiesFromEnv<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> extends LlmProvidersFromEnv<X> {
  /**
   * One strategy per keyed provider, under the provider's own id.
   */
  readonly strategies: LlmStrategyRegistry;
  /**
   * The strategy ids, in provider order.
   */
  readonly ids: ReadonlyArray<LlmStrategyId>;
}

/**
 * Resolve the providers ({@link resolveLlmProvidersFromEnv}) and build each one's completion strategy through its
 * transport's adapter (`makeLlmProviderStrategies`). A single-provider caller reads
 * `strategies.get(defaultProvider.id)`.
 *
 * @param config - The resolver's inputs and the shared strategy options.
 * @returns The resolution, the strategy registry and the ids in order. Inert: no I/O.
 * @throws {Error} When a provider fails to build (an unregistered transport or metering id).
 */
export function makeLlmStrategiesFromEnv<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: MakeLlmStrategiesFromEnvConfig<X>): LlmStrategiesFromEnv<X> {
  const { env, names, file, schema, fallbackKeys, ...options } = config;
  const resolved = resolveLlmProvidersFromEnv({ env, names, file, schema, adapters: options.adapters, fallbackKeys });
  const built = makeLlmProviderStrategies({ ...options, providers: resolved.providers });
  return { ...resolved, strategies: makeLlmStrategyRegistry(built), ids: built.map((strategy) => strategy.id) };
}

// MARK: Reachability
/**
 * Config for {@link readLlmReachableModels}.
 */
export interface ReadLlmReachableModelsConfig {
  /**
   * The resolved (possibly partial) tier map.
   */
  readonly modelTiers?: Maybe<LlmPartialModelTierMap>;
  /**
   * The host's routing block, when it declares one.
   */
  readonly routing?: Maybe<LlmModelRoutingConfig>;
}

/**
 * The model slugs a run could actually route to — every tier's slug (the tier map's and the routing block's) plus
 * every routing rule's slug. What scopes the gap report: a host that declares a provider on every machine would
 * otherwise report a blocking gap on every machine without its key, including the ones that never reach its slugs.
 *
 * @param config - The tier map and the routing block.
 * @returns The reachable slugs, de-duplicated, in first-seen order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function readLlmReachableModels(config: ReadLlmReachableModelsConfig): ReadonlyArray<LlmModelId> {
  const tierValues = [...Object.values(config.modelTiers ?? {}), ...Object.values(config.routing?.tiers ?? {})];
  const fromTiers = tierValues.flatMap((value) => (value == null ? [] : [readLlmTierModel(value)]));
  const fromRules = (config.routing?.rules ?? []).flatMap((rule) => (rule.model == null ? [] : [rule.model]));
  return concatArraysUnique(fromTiers, fromRules);
}

/**
 * A provider gap a reachable slug actually hits.
 */
export interface LlmReachableProviderGap extends LlmProviderConfigGap {
  /**
   * The reachable slug bound to the unkeyed provider — what an operator would lose.
   */
  readonly model: LlmModelId;
}

/**
 * Config for {@link filterLlmReachableProviderGaps}.
 */
export interface FilterLlmReachableProviderGapsConfig {
  /**
   * The unscoped gaps ({@link LlmProvidersFromEnv.gaps}).
   */
  readonly gaps: ReadonlyArray<LlmProviderConfigGap>;
  /**
   * The slugs the run can reach ({@link readLlmReachableModels}).
   */
  readonly reachableModels: ReadonlyArray<LlmModelId>;
  /**
   * The per-slug provider bindings (`llmModelProviderBindings`).
   */
  readonly providerByModel?: Maybe<LlmModelProviderBindingMap>;
}

/**
 * Scope the gaps to the ones a run would hit: one row per (gap, reachable slug bound to it). A gap no reachable slug
 * binds is dropped.
 *
 * @param config - The gaps, the reachable slugs and the per-slug bindings.
 * @returns The scoped gaps, in gap order then slug order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function filterLlmReachableProviderGaps(config: FilterLlmReachableProviderGapsConfig): ReadonlyArray<LlmReachableProviderGap> {
  const { gaps, reachableModels, providerByModel } = config;
  return gaps.flatMap((gap) => reachableModels.filter((model) => providerByModel?.[model] === gap.id).map((model) => ({ ...gap, model })));
}
