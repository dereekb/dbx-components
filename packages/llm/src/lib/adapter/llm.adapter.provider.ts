/**
 * **Provider resolution** — a resolved {@link LlmProviderConfig} → its effective base URL, its ACCOUNT (the metering id
 * and every account fact that follows it), and its completion strategy, all through the registered adapters.
 *
 * One resolution serves every path that builds strategies, so a host's two builders (one from its environment, one
 * from its model config file) can no longer drift: each provider builds through its own transport's adapter, under its
 * own id, with its account facets minted per PROVIDER — two instances on one account both answer, and a local box that
 * says it meters nothing gets none. Construction is inert: nothing here does I/O.
 */

import { type Maybe, type MaybeMap } from '@dereekb/util';
import { LLM_PROVIDER_FACET_NONE, type LlmCompletionProviderEntry } from '../model/config/llm.model.config.schema';
import { type LlmProviderConfig } from '../model/config/llm.model.config.resolve';
import { type LlmCredentialProbe, type LlmStrategy } from '../strategy/llm.strategy';
import { type LlmProviderStatusProviderId, type LlmProviderStatusSource } from '../strategy/llm.provider.status';
import { type LlmCallBillReader } from '../strategy/llm.call.bill';
import { type LlmCostBasis } from '../strategy/llm.usage';
import { type LlmAdapterConfig, type LlmCompletionAdapterConfig } from './llm.adapter';
import { checkLlmAdapterStrategy, findLlmAdapter, filterLlmAdaptersByFacet, resolveLlmAdapter, type LlmAdapterRegistry } from './llm.adapter.registry';

/**
 * Config pairing one provider (or a structural view of one) with the adapter registry.
 */
export interface LlmProviderAdaptersConfig<P> {
  /**
   * The provider to read.
   */
  readonly provider: P;
  /**
   * The registered adapters.
   */
  readonly adapters: LlmAdapterRegistry;
}

/**
 * A provider's EFFECTIVE base URL: its own `baseUrl`, else its transport's completion adapter's `defaultBaseUrl`.
 *
 * @param config - The provider (its `transport` and `baseUrl`) and the registry.
 * @returns The effective base URL, or `undefined` when neither declares one (or the transport is not registered).
 */
export function resolveLlmProviderBaseUrl(config: LlmProviderAdaptersConfig<Pick<LlmCompletionProviderEntry, 'transport' | 'baseUrl'>>): Maybe<string> {
  const { provider, adapters } = config;
  return provider.baseUrl ?? findLlmAdapter({ adapters, facet: 'completion', kind: provider.transport })?.defaultBaseUrl;
}

/**
 * Which account a provider bills — its metering id. The ONE decision its cost basis, account reads, credential probe
 * and bill reads share:.
 *
 * 1. a DECLARED `metering` wins, `'none'` included;
 * 2. else the FIRST registered metering adapter whose `isAccountBaseUrl` claims the provider's effective base URL;
 * 3. else {@link LLM_PROVIDER_FACET_NONE}. A provider with no effective base URL infers nothing.
 *
 * @param config - The provider (its `transport`, `baseUrl` and `metering`) and the registry.
 * @returns The metering id, `'none'` when the provider meters nothing.
 */
export function resolveLlmProviderMetering(config: LlmProviderAdaptersConfig<Pick<LlmCompletionProviderEntry, 'transport' | 'baseUrl' | 'metering'>>): LlmProviderStatusProviderId {
  const { provider, adapters } = config;
  let metering: LlmProviderStatusProviderId;

  if (provider.metering == null) {
    const baseUrl = resolveLlmProviderBaseUrl(config);
    const claimant = baseUrl == null ? undefined : filterLlmAdaptersByFacet({ adapters, facet: 'metering' }).find((adapter) => adapter.isAccountBaseUrl?.(baseUrl) === true);
    metering = claimant?.kind ?? LLM_PROVIDER_FACET_NONE;
  } else {
    metering = provider.metering;
  }

  return metering;
}

/**
 * Config for {@link resolveLlmProviderAccount}.
 */
export interface ResolveLlmProviderAccountConfig extends LlmProviderAdaptersConfig<LlmProviderConfig>, Partial<MaybeMap<Pick<LlmAdapterConfig, 'fetch'>>> {}

/**
 * One provider's ACCOUNT — the metering id and every fact that follows it. Each optional key is present only when an
 * adapter supplied it.
 */
export interface LlmProviderAccount {
  /**
   * The metering id ({@link resolveLlmProviderMetering}); `'none'` when the provider meters nothing.
   */
  readonly metering: LlmProviderStatusProviderId;
  /**
   * The provider's effective base URL.
   */
  readonly baseUrl?: string;
  /**
   * What the provider's synchronous `cost` is, from the metering adapter.
   */
  readonly costBasis?: LlmCostBasis;
  /**
   * The account status source, from the metering adapter.
   */
  readonly providerStatusSource?: LlmProviderStatusSource;
  /**
   * The account's own key check, from the credentialProbe adapter of the same metering id.
   */
  readonly credentialProbe?: LlmCredentialProbe;
  /**
   * The settled-bill reader, from the bill adapter of the same metering id.
   */
  readonly billReader?: LlmCallBillReader;
}

/**
 * Resolve one provider's ACCOUNT. A provider metering `'none'` gets no account facets. Otherwise the metering adapter is
 * REQUIRED (a provider declaring an account nobody can read is a configuration error), while the bill and
 * credentialProbe adapters of the same metering id are optional.
 *
 * @param config - The provider, the registry and the optional fetch seam.
 * @returns The account.
 * @throws {Error} When the provider's metering id has no registered metering adapter.
 */
export function resolveLlmProviderAccount(config: ResolveLlmProviderAccountConfig): LlmProviderAccount {
  const { provider, adapters, fetch } = config;
  const baseUrl = resolveLlmProviderBaseUrl({ provider, adapters });
  const metering = resolveLlmProviderMetering({ provider, adapters });
  const baseUrlPart = baseUrl == null ? {} : { baseUrl };
  let account: LlmProviderAccount;

  if (metering === LLM_PROVIDER_FACET_NONE) {
    account = { metering, ...baseUrlPart };
  } else {
    const meteringAdapter = resolveLlmAdapter({ adapters, facet: 'metering', kind: metering, label: `provider '${provider.id}'` });
    const billAdapter = findLlmAdapter({ adapters, facet: 'bill', kind: metering });
    const credentialProbeAdapter = findLlmAdapter({ adapters, facet: 'credentialProbe', kind: metering });
    const input: LlmAdapterConfig = { provider, ...baseUrlPart, ...(fetch == null ? {} : { fetch }) };

    account = {
      metering,
      ...baseUrlPart,
      ...(meteringAdapter.costBasis == null ? {} : { costBasis: meteringAdapter.costBasis }),
      providerStatusSource: meteringAdapter.make(input),
      ...(credentialProbeAdapter == null ? {} : { credentialProbe: credentialProbeAdapter.make(input) }),
      ...(billAdapter == null ? {} : { billReader: billAdapter.make(input) })
    };
  }

  return account;
}

/**
 * The options every provider's completion strategy shares. Each reaches the adapter only when set.
 */
export interface LlmProviderStrategyOptions extends Pick<LlmProviderAdaptersConfig<unknown>, 'adapters'>, Partial<MaybeMap<Pick<LlmCompletionAdapterConfig, 'defaultModel' | 'maxOutputTokens' | 'timeoutMs' | 'visionByModel' | 'reasoningOffByModel' | 'fetch'>>> {}

/**
 * Config for {@link makeLlmProviderStrategy}.
 */
export interface MakeLlmProviderStrategyConfig extends LlmProviderStrategyOptions {
  /**
   * The resolved provider to build.
   */
  readonly provider: LlmProviderConfig;
}

/**
 * Config for {@link makeLlmProviderStrategies}.
 */
export interface MakeLlmProviderStrategiesConfig extends LlmProviderStrategyOptions {
  /**
   * The resolved providers to build (`resolveLlmProviderConfigs`), in order.
   */
  readonly providers: Maybe<ReadonlyArray<LlmProviderConfig>>;
}

/**
 * Build one provider's completion strategy through its transport's completion adapter, handing it the provider's
 * effective base URL, the shared options and the provider's account facets (cost basis, status source and credential
 * probe).
 *
 * The strategy must register under the provider's own id: a strategy minted under the transport name would make every
 * second instance of that transport silently replace the first.
 *
 * @param config - The provider, the registry and the shared options.
 * @returns The strategy, `id` = the provider's id. Inert: no I/O.
 * @throws {Error} When the provider's transport has no completion adapter, its metering id has no metering adapter, or
 *   the adapter mints a strategy under another id.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmProviderStrategy(config: MakeLlmProviderStrategyConfig): LlmStrategy {
  const { provider, adapters, defaultModel, maxOutputTokens, timeoutMs, visionByModel, reasoningOffByModel, fetch } = config;
  const label = `provider '${provider.id}'`;
  // The transport first: an unregistered transport is the more fundamental error.
  const adapter = resolveLlmAdapter({ adapters, facet: 'completion', kind: provider.transport, label });
  const account = resolveLlmProviderAccount({ provider, adapters, fetch });

  const minted = adapter.make({
    provider,
    ...(account.baseUrl == null ? {} : { baseUrl: account.baseUrl }),
    ...(fetch == null ? {} : { fetch }),
    ...(defaultModel == null ? {} : { defaultModel }),
    ...(maxOutputTokens == null ? {} : { maxOutputTokens }),
    ...(timeoutMs == null ? {} : { timeoutMs }),
    ...(visionByModel == null ? {} : { visionByModel }),
    ...(reasoningOffByModel == null ? {} : { reasoningOffByModel }),
    ...(account.costBasis == null ? {} : { costBasis: account.costBasis }),
    ...(account.providerStatusSource == null ? {} : { providerStatusSource: account.providerStatusSource }),
    ...(account.credentialProbe == null ? {} : { credentialProbe: account.credentialProbe })
  });

  return checkLlmAdapterStrategy({ label, adapter, providerId: provider.id, strategy: minted });
}

/**
 * Build every provider's completion strategy ({@link makeLlmProviderStrategy}), in provider order. Seed a strategy
 * registry with the result (`makeLlmStrategyRegistry([...yourOwn, ...built])`).
 *
 * @param config - The providers, the registry and the shared options.
 * @returns The strategies, one per provider (empty when there are none). Inert: no I/O.
 * @throws {Error} When any provider fails to build.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmProviderStrategies(config: MakeLlmProviderStrategiesConfig): ReadonlyArray<LlmStrategy> {
  const { providers, ...options } = config;
  return (providers ?? []).map((provider) => makeLlmProviderStrategy({ ...options, provider }));
}
