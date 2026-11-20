/**
 * The billed-spec lane as ONE factory: {@link makeLlmLiveLane} takes the host's env names, schema, adapters and an
 * injectable provider resolver (default: `/node`'s `resolveLlmProvidersFromEnv`), and yields everything a live spec run
 * needs — the live completion and decision strategies, the credential / quota probes, the hermetic key strip, and the
 * vitest `globalSetup` that probes once and stamps fail-open verdicts for the workers.
 *
 * Nothing bills unless the lane is UNLOCKED (`LLM_LIVE_SPECS=1` by default) AND keyed. A locked lane reads no file,
 * builds no strategy and makes no request; its live helpers answer `undefined`, so one `describe.skipIf(LIVE == null)`
 * is a complete gate.
 */

import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { type Maybe, mergeObjects, type Milliseconds } from '@dereekb/util';
import {
  evaluateLlmQuotaGate,
  type LlmAdapterRegistry,
  type LlmModelConfigBaseTypes,
  type LlmModelConfigFile,
  type LlmModelConfigSchema,
  type LlmModelConfigTypes,
  type LlmModelId,
  type LlmProviderConfig,
  type LlmProviderStatusReport,
  type LlmProviderStrategyOptions,
  type LlmStrategiesHealthReport,
  type LlmStrategy,
  type LlmStrategyId,
  llmModelReasoningOffEncodings,
  llmModelVisionCapabilities,
  resolveLlmProviderBaseUrl,
  readLlmTierModel,
  makeLlmDecisionStrategies,
  makeLlmProviderStrategies,
  makeLlmProviderStrategy,
  makeLlmStrategyRegistry,
  type LlmDecisionStrategy,
  probeLlmCredentials,
  readLlmProviderStatus,
  resolveLlmDefaultModelTierKey
} from '@dereekb/llm';
import {
  DEFAULT_LLM_ENV_NAMES,
  firstLlmEnvEntry,
  type LlmEnvNames,
  type LlmEnvVarNames,
  type LlmEnvView,
  readLlmEnvApiKeyNames,
  llmModelProfileDefaultModelFromEnv,
  type LlmModelProfileFromEnv,
  type LlmProvidersFromEnv,
  loadEffectiveLlmModelConfigFile,
  resolveLlmModelProfileFromEnv,
  resolveLlmModelTierEnv,
  resolveLlmProvidersFromEnv,
  type ResolveLlmProvidersFromEnvConfig
} from '@dereekb/llm/node';
import { DEFAULT_LLM_LIVE_LANE_ENV_NAMES, isLlmEnvFlagEnabled, type LlmLiveLaneEnvNames } from './llm.test.env';
import { decorateLlmLiveStrategyAuthFailures, type LlmLiveDecisionStrategyFromEnv, type LlmLiveStrategyBinding, toLlmLiveStrategyBinding, type LlmLiveStrategyFromEnv } from './llm.test.live';
import { llmCredentialVerdictFromEnv, llmCredentialVerdictFromReport, llmQuotaVerdictFromEnv, llmQuotaVerdictFromGate, parseLlmQuotaMaxUsed, toLlmCredentialVerdictEnv, toLlmQuotaVerdictEnv } from './llm.test.verdict';

// MARK: Config
/**
 * Resolves the providers from the environment — typed as `/node`'s `resolveLlmProvidersFromEnv`, which is the default.
 * A host injects a wrapper to add, drop or reorder providers.
 */
export type LlmLiveLaneProviderResolver<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> = (config: ResolveLlmProvidersFromEnvConfig<X>) => LlmProvidersFromEnv<X>;

/**
 * What a host's `defaultModel` function receives.
 */
export interface LlmLiveLaneDefaultModelParams {
  /**
   * The provider the lane bills.
   */
  readonly provider: LlmProviderConfig;
  /**
   * The provider's effective base URL.
   */
  readonly baseUrl?: Maybe<string>;
}

/**
 * The host's per-provider fallback model: a slug, or a function of the provider and its base URL. A function returning
 * `undefined` means "this provider has no safe default".
 */
export type LlmLiveLaneDefaultModel = LlmModelId | ((input: LlmLiveLaneDefaultModelParams) => Maybe<LlmModelId>);

/**
 * Where the lane's model config comes from.
 */
export interface LlmLiveLaneModelConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The operator's models file, read (with the models-file variable as an override) only when the lane is unlocked.
   * Absent ⇒ no file is read.
   */
  readonly defaultPath?: Maybe<string>;
  /**
   * The host's built-in config — merged under the operator's file, or used alone when no path is set. Its declared
   * `apiKeyEnv`s join the hermetic strip.
   */
  readonly base?: Maybe<LlmModelConfigFile<X>>;
}

/**
 * Config for {@link makeLlmLiveLane}.
 */
export interface LlmLiveLaneConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The lane's own switch and verdict names, merged over {@link DEFAULT_LLM_LIVE_LANE_ENV_NAMES}.
   */
  readonly names?: Maybe<Partial<LlmLiveLaneEnvNames>>;
  /**
   * The provider / model env names; defaults to `/node`'s `DEFAULT_LLM_ENV_NAMES`.
   */
  readonly envNames?: Maybe<LlmEnvNames>;
  /**
   * The host's model config schema.
   */
  readonly schema: LlmModelConfigSchema<X>;
  /**
   * The adapters the host's providers build through.
   */
  readonly adapters: LlmAdapterRegistry;
  /**
   * Where the model config comes from; absent ⇒ no file read and an empty config.
   */
  readonly modelConfig?: Maybe<LlmLiveLaneModelConfig<X>>;
  /**
   * Keys the fallback provider may borrow (see `resolveLlmProvidersFromEnv`).
   */
  readonly fallbackKeys?: Maybe<LlmEnvView>;
  /**
   * THE injected provider resolver; defaults to `resolveLlmProvidersFromEnv`.
   */
  readonly resolveProviders?: Maybe<LlmLiveLaneProviderResolver<X>>;
  /**
   * The host's per-provider fallback model, used when neither the environment nor a profile pins one. A function
   * returning `undefined` means "this provider has no safe default" — the lane then skips with a warning.
   */
  readonly defaultModel?: Maybe<LlmLiveLaneDefaultModel>;
  /**
   * Shared options for every completion strategy the lane builds.
   */
  readonly strategyOptions?: Maybe<Pick<LlmProviderStrategyOptions, 'maxOutputTokens' | 'timeoutMs'>>;
  /**
   * The decision route preference; defaults to the adapters' registration order.
   */
  readonly decisionRoutePreference?: Maybe<ReadonlyArray<LlmStrategyId>>;
  /**
   * The per-call timeout of every decision strategy the lane builds.
   */
  readonly decisionTimeoutMs?: Maybe<Milliseconds>;
  /**
   * Extra key variables the hermetic strip removes (pay-as-you-go keys, management keys, …).
   */
  readonly extraProviderKeyNames?: Maybe<LlmEnvVarNames>;
  /**
   * The log and message prefix; defaults to `llm`.
   */
  readonly label?: Maybe<string>;
  /**
   * Where the lane writes its lines; defaults to `console.warn`.
   */
  readonly log?: Maybe<(message: string) => void>;
}

// MARK: Lane
/**
 * Where the lane's model came from.
 */
export type LlmLiveLaneModelSource = 'env' | 'profile' | 'host';

/**
 * One resolution of the lane — the provider resolution plus the effective config, base URL and model.
 */
export interface LlmLiveLaneResolution<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> extends LlmProvidersFromEnv<X> {
  /**
   * The effective model config (the operator's file merged over `base`, or `base`, or `{}`).
   */
  readonly modelConfig: LlmModelConfigFile<X>;
  /**
   * The models file path that was read, when one was.
   */
  readonly modelConfigPath?: Maybe<string>;
  /**
   * The default provider's effective base URL.
   */
  readonly baseUrl?: Maybe<string>;
  /**
   * The model the lane bills.
   */
  readonly model?: Maybe<LlmModelId>;
  /**
   * Where {@link model} came from.
   */
  readonly modelSource?: Maybe<LlmLiveLaneModelSource>;
  /**
   * The active model profile, when one is selected.
   */
  readonly profile?: Maybe<LlmModelProfileFromEnv>;
}

/**
 * An environment to read; defaults to `process.env`.
 */
export interface LlmLiveLaneEnvParams {
  /**
   * The environment to read; defaults to `process.env`.
   */
  readonly env?: Maybe<LlmEnvView>;
}

/**
 * Config for the lane's probes.
 */
export interface LlmLiveLaneProbeParams extends LlmLiveLaneEnvParams {
  /**
   * The HTTP seam the probes go through — a spec's fake.
   */
  readonly fetch?: Maybe<ConfiguredFetch>;
  /**
   * Aborts the probes.
   */
  readonly signal?: Maybe<AbortSignal>;
}

/**
 * Config for {@link LlmLiveLane.liveStrategyBinding}.
 */
export interface LlmLiveStrategyBindingParams extends LlmLiveLaneEnvParams {
  /**
   * A pre-built or wrapped strategy; defaults to {@link LlmLiveLane.makeLiveStrategy}.
   */
  readonly strategy?: Maybe<LlmStrategy>;
}

/**
 * A mutable environment — `process.env` satisfies it.
 */
export type LlmMutableEnv = Record<string, Maybe<string>>;

/**
 * Config for {@link LlmLiveLane.makeGlobalSetup}.
 */
export interface LlmLiveGlobalSetupConfig {
  /**
   * The environment the setup reads and stamps; defaults to `process.env` (which the workers inherit).
   */
  readonly env?: Maybe<LlmMutableEnv>;
  /**
   * The HTTP seam the probes go through.
   */
  readonly fetch?: Maybe<ConfiguredFetch>;
  /**
   * Aborts the probes.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * Strip provider keys when the lane is locked; defaults to `true`.
   */
  readonly hermetic?: Maybe<boolean>;
}

/**
 * A vitest `globalSetup` function. A plain type, so `/test` needs no vitest import.
 */
export type LlmLiveGlobalSetup = () => Promise<void>;

/**
 * The live lane {@link makeLlmLiveLane} builds.
 */
export interface LlmLiveLane<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The log and message prefix.
   */
  readonly label: string;
  /**
   * The effective lane names.
   */
  readonly names: LlmLiveLaneEnvNames;
  /**
   * The effective provider / model env names.
   */
  readonly envNames: LlmEnvNames;
  /**
   * Whether the lane's unlock switch is on.
   *
   * @param env - The environment; defaults to `process.env`.
   * @returns `true` when billed specs may run.
   */
  isUnlocked(env?: Maybe<LlmEnvView>): boolean;
  /**
   * Resolve the providers, the effective config, the base URL and the model. Inert except the models file read.
   *
   * @param config - The environment.
   * @returns The resolution.
   * @throws {Error} When the models file is malformed or an explicit path is missing, or the selected profile is not
   *   defined.
   */
  resolve(config?: Maybe<LlmLiveLaneEnvParams>): LlmLiveLaneResolution<X>;
  /**
   * The live provider handle for a billed spec, or `undefined` when the run must skip — locked, keyless, a `dead`
   * credential verdict, an `exhausted` quota verdict, or no model. Every skip past the lock is logged.
   *
   * @param env - The environment; defaults to `process.env`.
   * @returns The handle, or `undefined`.
   */
  liveStrategyFromEnv(env?: Maybe<LlmEnvView>): Maybe<LlmLiveStrategyFromEnv>;
  /**
   * Build the live strategy inside an OPEN gate.
   *
   * @param env - The environment; defaults to `process.env`.
   * @returns A fresh decorated strategy.
   * @throws {Error} When nothing resolves — the caller's skip gate is wrong.
   */
  makeLiveStrategy(env?: Maybe<LlmEnvView>): LlmStrategy;
  /**
   * The registry + default id routing at the live strategy.
   *
   * @param config - A pre-built strategy and the environment.
   * @returns The binding.
   * @throws {Error} When no strategy is passed and nothing resolves.
   */
  liveStrategyBinding(config?: Maybe<LlmLiveStrategyBindingParams>): LlmLiveStrategyBinding;
  /**
   * The live decision backend, or `undefined` when locked or no keyed provider serves a decision. Applies NO credential
   * veto of its own: pair it with {@link liveStrategyFromEnv} in the gate.
   *
   * @param env - The environment; defaults to `process.env`.
   * @returns The backend, or `undefined`.
   */
  liveDecisionStrategyFromEnv(env?: Maybe<LlmEnvView>): Maybe<LlmLiveDecisionStrategyFromEnv>;
  /**
   * Probe every keyed provider's credential. Never throws for a probe outcome.
   *
   * @param config - The environment, the fetch seam and an abort signal.
   * @returns The report; `{ ready: true, checked: [] }` when nothing is keyed.
   */
  probeCredentials(config?: Maybe<LlmLiveLaneProbeParams>): Promise<LlmStrategiesHealthReport>;
  /**
   * Read every keyed provider's quota status. Never throws for a read outcome.
   *
   * @param config - The environment, the fetch seam and an abort signal.
   * @returns The report; `{ checked: [] }` when nothing is keyed.
   */
  readProviderStatus(config?: Maybe<LlmLiveLaneProbeParams>): Promise<LlmProviderStatusReport>;
  /**
   * Every key variable the hermetic strip removes, unique and in order: the env-default key names, the `apiKeyEnv`s
   * declared in `modelConfig.base`, then `extraProviderKeyNames`.
   *
   * @returns The names.
   */
  providerKeyNames(): LlmEnvVarNames;
  /**
   * Delete every provider key from `env` unless the lane is unlocked.
   *
   * @param env - The environment to strip (mutated).
   * @returns The names removed; `[]` when unlocked.
   */
  stripProviderKeysUnlessUnlocked(env: LlmMutableEnv): ReadonlyArray<string>;
  /**
   * The vitest `globalSetup`: hermetic when locked, probe-and-stamp when unlocked. A host file is
   * `export default LANE.makeGlobalSetup();`.
   *
   * @param config - The environment, the fetch seam, an abort signal and the hermetic switch.
   * @returns The setup function.
   */
  makeGlobalSetup(config?: Maybe<LlmLiveGlobalSetupConfig>): LlmLiveGlobalSetup;
}

/**
 * The first name of a list, or a placeholder when it is empty.
 *
 * @param names - The names.
 * @returns The first one.
 */
function firstNameOf(names: Maybe<LlmEnvVarNames>): string {
  return names?.[0] ?? '(unnamed)';
}

/**
 * Build a live lane — see {@link LlmLiveLane}.
 *
 * Model precedence, first hit wins: the default tier's model variable (`LLM_MODEL`) → the active profile's default
 * tier (`LLM_MODEL_PROFILE` or the file's `active`) → the host's `defaultModel`. The setup and every worker run the SAME
 * resolution, so the setup's lane line and the specs agree by construction.
 *
 * Verdicts fail open: an absent or unrecognized verdict reads `unchecked` and never vetoes.
 *
 * @param config - The host's names, schema, adapters, model config and resolver.
 * @returns The lane. Inert: nothing is read until a method is called.
 *
 * @example
 * ```ts
 * export const LIVE_LANE = makeLlmLiveLane({ schema, adapters, modelConfig: { defaultPath, base }, defaultModel: 'vendor/model-flash', label: 'my-app' });
 * const LIVE = LIVE_LANE.liveStrategyFromEnv();
 * describe.skipIf(LIVE == null)('summarize (live)', () => { ... });
 * ```
 */
export function makeLlmLiveLane<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: LlmLiveLaneConfig<X>): LlmLiveLane<X> {
  const { schema, adapters, modelConfig, fallbackKeys, defaultModel, strategyOptions, decisionRoutePreference, decisionTimeoutMs, extraProviderKeyNames } = config;
  // mergeObjects: an explicit `undefined` name keeps its default env name (a spread would read `env['undefined']`).
  const names = mergeObjects<LlmLiveLaneEnvNames>([DEFAULT_LLM_LIVE_LANE_ENV_NAMES, config.names]);
  const envNames = config.envNames ?? DEFAULT_LLM_ENV_NAMES;
  const resolveProviders: LlmLiveLaneProviderResolver<X> = config.resolveProviders ?? resolveLlmProvidersFromEnv;
  const label = config.label ?? 'llm';
  const log = config.log ?? ((message: string) => console.warn(message));

  const isUnlocked = (env?: Maybe<LlmEnvView>): boolean => isLlmEnvFlagEnabled((env ?? process.env)[names.unlock]);

  const resolve = (resolveConfig?: Maybe<LlmLiveLaneEnvParams>): LlmLiveLaneResolution<X> => {
    const env = resolveConfig?.env ?? process.env;
    let file: LlmModelConfigFile<X>;
    let modelConfigPath: Maybe<string>;

    if (modelConfig?.defaultPath == null) {
      file = modelConfig?.base ?? {};
    } else {
      const effective = loadEffectiveLlmModelConfigFile({ env, names: envNames, defaultPath: modelConfig.defaultPath, schema, base: modelConfig.base });
      file = effective.file;
      modelConfigPath = effective.filePath;
    }

    const providers = resolveProviders({ env, names: envNames, file, schema, adapters, fallbackKeys });
    const provider = providers.defaultProvider;
    const baseUrl = provider == null ? undefined : resolveLlmProviderBaseUrl({ provider, adapters });
    const tiers = resolveLlmModelTierEnv({ env, names: envNames });
    const tierValue = tiers.modelTiers?.[resolveLlmDefaultModelTierKey(tiers.defaultTier)];
    const profile = resolveLlmModelProfileFromEnv({ env, names: envNames, file, source: modelConfigPath, schema });
    let model: Maybe<LlmModelId> = tierValue == null ? undefined : readLlmTierModel(tierValue);
    let modelSource: Maybe<LlmLiveLaneModelSource> = model == null ? undefined : 'env';

    if (model == null) {
      model = llmModelProfileDefaultModelFromEnv({ profile, env, names: envNames });
      modelSource = model == null ? undefined : 'profile';
    }

    if (model == null && provider != null && defaultModel != null) {
      model = typeof defaultModel === 'function' ? defaultModel({ provider, baseUrl }) : defaultModel;
      modelSource = model == null ? undefined : 'host';
    }

    return { ...providers, modelConfig: file, modelConfigPath, baseUrl, model, modelSource, profile };
  };

  const liveStrategyFromEnv = (env?: Maybe<LlmEnvView>): Maybe<LlmLiveStrategyFromEnv> => {
    const view = env ?? process.env;
    let live: Maybe<LlmLiveStrategyFromEnv>;

    if (isUnlocked(view)) {
      const resolution = resolve({ env: view });
      const provider = resolution.defaultProvider;

      if (provider != null) {
        const model = resolution.model;
        const apiKeyEnv = provider.apiKeyEnv ?? '(an unnamed variable)';
        const credential = llmCredentialVerdictFromEnv({ env: view, names });
        const quota = llmQuotaVerdictFromEnv({ env: view, names });

        if (model != null && credential.verdict === 'dead') {
          // The one case a pure resolution structurally cannot see: a revoked key is still a non-empty string. An absent
          // verdict reads 'unchecked' and never lands here, so this only fires on evidence.
          log(`[${label}] live specs skipped: the '${provider.id}' provider REJECTED the credential in ${apiKeyEnv}: ${credential.detail ?? 'no detail reported'}. Rotate that key, or set ${names.skipCredentialProbe}=1 to run anyway.`);
        } else if (model != null && quota.verdict === 'exhausted') {
          // A live key on a spent quota: every spec behind it would fail, so skipping is the honest outcome — loudly, and
          // naming the way out. Only reached on a MEASURED fraction ('unchecked' is the fail-open default).
          log(`[${label}] live specs skipped: ${quota.detail ?? 'the provider quota is spent'}. Wait for the window to reset, select another model profile (${firstNameOf(envNames.modelProfile)}), raise ${names.quotaMaxUsed}, or set ${names.skipQuotaProbe}=1 to run anyway.`);
        } else if (model == null) {
          // Keyed, but nothing pins a model and the host has no safe default for this provider. Skipping is right;
          // skipping QUIETLY is not.
          const tier = resolveLlmDefaultModelTierKey(resolveLlmModelTierEnv({ env: view, names: envNames }).defaultTier);
          log(`[${label}] live specs skipped: the '${provider.id}' provider is keyed via ${apiKeyEnv} but no model is pinned. Set ${firstNameOf(envNames.tierModels[tier])} or select a model profile (${firstNameOf(envNames.modelProfile)}) to run them.`);
        } else {
          const file = resolution.modelConfig;
          const baseUrl = resolution.baseUrl;
          live = {
            strategyId: provider.id,
            model,
            apiKeyEnv,
            ...(baseUrl == null ? {} : { baseUrl }),
            makeStrategy: () =>
              decorateLlmLiveStrategyAuthFailures({
                strategy: makeLlmProviderStrategy({ provider, adapters, defaultModel: model, reasoningOffByModel: llmModelReasoningOffEncodings(file), visionByModel: llmModelVisionCapabilities(file), ...strategyOptions }),
                providerId: provider.id,
                apiKeyEnv,
                baseUrl,
                model,
                selectEnv: envNames.defaultProvider[0],
                label
              })
          };
        }
      }
    }

    return live;
  };

  const makeLiveStrategy = (env?: Maybe<LlmEnvView>): LlmStrategy => {
    const live = liveStrategyFromEnv(env);

    if (live == null) {
      const modelVar = firstNameOf(envNames.tierModels[resolveLlmDefaultModelTierKey(resolveLlmModelTierEnv({ env: env ?? process.env, names: envNames }).defaultTier)]);
      throw new Error(`${label} live specs: no live LLM provider resolved from the environment; a describe.skipIf gate should have skipped this block. Set ${names.unlock}=1 and a provider key (and ${modelVar} when the provider has no default model).`);
    }

    return live.makeStrategy();
  };

  const liveStrategyBinding = (bindingConfig?: Maybe<LlmLiveStrategyBindingParams>): LlmLiveStrategyBinding => toLlmLiveStrategyBinding(bindingConfig?.strategy ?? makeLiveStrategy(bindingConfig?.env));

  const liveDecisionStrategyFromEnv = (env?: Maybe<LlmEnvView>): Maybe<LlmLiveDecisionStrategyFromEnv> => {
    const view = env ?? process.env;
    let result: Maybe<LlmLiveDecisionStrategyFromEnv>;

    if (isUnlocked(view)) {
      const resolution = resolve({ env: view });
      const registry = makeLlmDecisionStrategies({ providers: resolution.providers, adapters, routePreference: decisionRoutePreference, timeoutMs: decisionTimeoutMs });
      const pinned = firstLlmEnvEntry({ env: view, names: envNames.decisionProvider ?? [] });
      let strategy: Maybe<LlmDecisionStrategy> = registry.values()[0];

      if (pinned != null) {
        strategy = registry.get(pinned.value);

        // A typo'd pin would otherwise run the decision specs against whichever strategy happened to register first.
        if (strategy == null) {
          const ids = registry.values().map((candidate) => candidate.id);
          throw new Error(`${label} live specs: ${pinned.name} names decision strategy '${pinned.value}', which is not registered (have: ${ids.length === 0 ? '(none)' : ids.join(', ')}).`);
        }
      }

      result = strategy == null ? undefined : { strategyId: strategy.id, strategy };
    }

    return result;
  };

  const buildKeyedStrategies = (probeConfig?: Maybe<LlmLiveLaneProbeParams>) => {
    const resolution = resolve({ env: probeConfig?.env });
    const built = makeLlmProviderStrategies({ providers: resolution.providers, adapters, fetch: probeConfig?.fetch, ...strategyOptions });
    return { strategies: makeLlmStrategyRegistry(built), required: built.map((strategy) => strategy.id), signal: probeConfig?.signal ?? undefined };
  };

  const probeCredentials = async (probeConfig?: Maybe<LlmLiveLaneProbeParams>): Promise<LlmStrategiesHealthReport> => {
    const keyed = buildKeyedStrategies(probeConfig);
    return keyed.required.length === 0 ? { ready: true, checked: [] } : probeLlmCredentials(keyed);
  };

  const readProviderStatus = async (probeConfig?: Maybe<LlmLiveLaneProbeParams>): Promise<LlmProviderStatusReport> => {
    const keyed = buildKeyedStrategies(probeConfig);
    return keyed.required.length === 0 ? { checked: [] } : readLlmProviderStatus(keyed);
  };

  const providerKeyNames = (): LlmEnvVarNames => {
    const base = modelConfig?.base;
    const baseEntries = [...Object.values(base?.providers ?? {}), ...Object.values(base?.extensionProviders ?? {})];
    const baseKeyNames = baseEntries.flatMap((entry) => (entry.apiKeyEnv == null || entry.apiKeyEnv.length === 0 ? [] : [entry.apiKeyEnv]));
    return Array.from(new Set([...readLlmEnvApiKeyNames(envNames), ...baseKeyNames, ...(extraProviderKeyNames ?? [])]));
  };

  const stripProviderKeysUnlessUnlocked = (env: LlmMutableEnv): ReadonlyArray<string> => {
    let removed: string[] = [];

    if (!isUnlocked(env)) {
      removed = providerKeyNames().filter((name) => env[name] != null);
      removed.forEach((name) => {
        delete env[name];
      });
    }

    return removed;
  };

  const logLaneOf = (resolution: LlmLiveLaneResolution<X>): void => {
    const provider = resolution.defaultProvider;

    if (provider == null) {
      log(`[${label}] live specs: no provider is keyed (${providerKeyNames().join(', ')}); every live spec will skip.`);
    } else {
      const profile = resolution.profile;
      let source: string;

      switch (resolution.modelSource) {
        case 'env':
          source = 'pinned by env';
          break;
        case 'profile':
          source = `model profile '${profile?.profileName ?? '(unnamed)'}' (${profile?.overrideEnv ?? resolution.modelConfigPath ?? 'the host config'})`;
          break;
        case 'host':
          source = 'the host default';
          break;
        default:
          source = 'no model pinned';
          break;
      }

      log(`[${label}] live specs: '${provider.id}' via ${provider.apiKeyEnv ?? '(an unnamed variable)'} on ${resolution.model ?? '(no model)'} (${source})`);
    }
  };

  const makeGlobalSetup = (setupConfig?: Maybe<LlmLiveGlobalSetupConfig>): LlmLiveGlobalSetup => {
    return async () => {
      const env = setupConfig?.env ?? process.env;
      const probeConfig: LlmLiveLaneProbeParams = { env, fetch: setupConfig?.fetch, signal: setupConfig?.signal };

      if (isUnlocked(env)) {
        // Resolve FIRST: a malformed file or an unknown profile throws here, before anything is billed.
        logLaneOf(resolve({ env }));

        if (isLlmEnvFlagEnabled(env[names.skipCredentialProbe])) {
          // A stale verdict must not veto a run the operator forced.
          delete env[names.credentialVerdict];
          delete env[names.credentialDetail];
        } else {
          Object.assign(env, toLlmCredentialVerdictEnv({ result: llmCredentialVerdictFromReport(await probeCredentials(probeConfig)), names }));
        }

        if (isLlmEnvFlagEnabled(env[names.skipQuotaProbe])) {
          delete env[names.quotaVerdict];
          delete env[names.quotaDetail];
        } else {
          const report = await readProviderStatus(probeConfig);
          const maxUsedFraction = parseLlmQuotaMaxUsed(env[names.quotaMaxUsed]);
          const result = llmQuotaVerdictFromGate(evaluateLlmQuotaGate({ report, ...(maxUsedFraction == null ? {} : { maxUsedFraction }) }));
          Object.assign(env, toLlmQuotaVerdictEnv({ result, names }));

          if (result.verdict === 'ok' && result.detail != null) {
            log(`[${label}] live specs: provider quota: ${result.detail}`);
          }
        }
      } else {
        if (setupConfig?.hermetic !== false) {
          stripProviderKeysUnlessUnlocked(env);
        }
      }
    };
  };

  return {
    label,
    names,
    envNames,
    isUnlocked,
    resolve,
    liveStrategyFromEnv,
    makeLiveStrategy,
    liveStrategyBinding,
    liveDecisionStrategyFromEnv,
    probeCredentials,
    readProviderStatus,
    providerKeyNames,
    stripProviderKeysUnlessUnlocked,
    makeGlobalSetup
  };
}
