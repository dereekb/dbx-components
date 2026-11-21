/**
 * **Adapters** — what a provider entry (`/openai`, `/openrouter`, `/zenmux`, a host's own) exports so a host can turn
 * its configured providers into strategies. A provider entry exports one adapter per thing it can do for a host, each a
 * descriptor of declared facts plus a `make` factory, so a new transport is a new adapter rather than another case in a
 * switch that two call sites must keep in step (two hand-kept switches drift: they fall through in opposite
 * directions).
 *
 * Five facets:
 *
 * - `completion` — keyed by TRANSPORT; mints an {@link LlmStrategy}.
 * - `decision` — keyed by DECISION ROUTE; mints an {@link LlmDecisionStrategy}.
 * - `metering`, `bill`, `credentialProbe` — keyed by METERING ID. These three are about the provider's ACCOUNT rather
 *   than its wire, and all three follow one answer (the provider's metering id), so a provider's cost, quota and key
 *   checks can never disagree about which account it is on.
 *
 * Every `make` is INERT: it builds an object and does no I/O. Network work happens only when a caller invokes what it
 * built.
 */

import { type Maybe, type Milliseconds, type WebsiteUrlWithPrefix, type WebsiteUrl } from '@dereekb/util';
import { type LlmModelId, type LlmStrategyId, type LlmTokenCount } from '../model/llm.value';
import { type LlmModelReasoningOffMap, type LlmModelVisionMap } from '../model/llm.model.wire';
import { type LlmProviderConfig } from '../model/config/llm.model.config.resolve';
import { type LlmCredentialProbe, type LlmStrategy } from '../strategy/llm.strategy';
import { type LlmProviderStatusSource } from '../strategy/llm.provider.status';
import { type LlmCallBillReader } from '../strategy/llm.call.bill';
import { type LlmCostBasis } from '../strategy/llm.usage';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { type LlmDecisionStrategy } from '../decision/llm.decision.strategy';

/**
 * The five things an adapter can do for a host.
 */
export type LlmAdapterFacet = 'completion' | 'decision' | 'metering' | 'bill' | 'credentialProbe';

/**
 * The value a provider entry names: a transport (completion), a decision route (decision) or a metering id (metering,
 * bill, credentialProbe). Never `'none'` (`LLM_PROVIDER_FACET_NONE`), which means "no such facet".
 */
export type LlmAdapterKind = string;

/**
 * What every adapter's `make` receives.
 */
export interface LlmAdapterConfig {
  /**
   * The RESOLVED provider. It carries the key VALUE — never log it.
   */
  readonly provider: LlmProviderConfig;
  /**
   * The EFFECTIVE endpoint: the provider's own `baseUrl`, else its transport adapter's
   * {@link LlmCompletionAdapter.defaultBaseUrl}. Absent when neither declares one.
   */
  readonly baseUrl?: Maybe<WebsiteUrl>;
  /**
   * The HTTP seam for probes, account reads and bill reads — a spec's fake. Absent ⇒ the adapter's own default.
   */
  readonly fetch?: Maybe<ConfiguredFetch>;
}

/**
 * What a {@link LlmCompletionAdapter}'s `make` receives: the provider plus the host's shared strategy options and the
 * provider's account facets. An unset key is absent or nullish: read each with `??` / `== null`, as the stock adapters
 * do. Never spread the config over your own defaults; `mergeObjects` keeps a default against an explicit `undefined`.
 */
export interface LlmCompletionAdapterConfig extends LlmAdapterConfig {
  /**
   * The model a request that names none runs on.
   */
  readonly defaultModel?: Maybe<LlmModelId>;
  /**
   * The provider's default completion-length cap (`maxOutputTokensByProvider[provider.id]`, else the shared
   * `maxOutputTokens`). A stock transport declares it as its strategy's `defaultMaxOutputTokens`, so a dispatcher
   * sends it when nothing above names a cap; a custom adapter's strategy should too.
   */
  readonly maxOutputTokens?: Maybe<LlmTokenCount>;
  /**
   * The per-call timeout.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
  /**
   * The per-slug vision facts the strategy reads before it sends an attachment.
   */
  readonly visionByModel?: Maybe<LlmModelVisionMap>;
  /**
   * The per-slug reasoning-OFF encodings.
   */
  readonly reasoningOffByModel?: Maybe<LlmModelReasoningOffMap>;
  /**
   * What the provider's synchronous `cost` is, from its metering adapter.
   */
  readonly costBasis?: Maybe<LlmCostBasis>;
  /**
   * The provider's account status source, from its metering adapter.
   */
  readonly providerStatusSource?: Maybe<LlmProviderStatusSource>;
  /**
   * The provider's credential probe, from its credentialProbe adapter. When present it REPLACES the transport's
   * generic probe (a gateway may answer a generic catalog read with 200 for any key).
   */
  readonly credentialProbe?: Maybe<LlmCredentialProbe>;
}

/**
 * What a {@link LlmDecisionAdapter}'s `make` receives.
 */
export interface LlmDecisionAdapterConfig extends LlmAdapterConfig {
  /**
   * The per-call timeout; absent ⇒ the strategy's own default.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
}

/**
 * What every adapter declares.
 */
export interface LlmAdapterBase<F extends LlmAdapterFacet> {
  /**
   * The facet this adapter serves.
   */
  readonly facet: F;
  /**
   * The transport, decision route or metering id this adapter serves — the value a provider entry names.
   */
  readonly kind: LlmAdapterKind;
}

/**
 * A COMPLETION adapter — keyed by transport.
 *
 * Its `make` must register the strategy under the PROVIDER's id (`id = provider.id`) with `kind` = this adapter's
 * {@link LlmAdapterBase.kind}, so two providers on one transport stay two strategies. The resolver checks the id.
 */
export interface LlmCompletionAdapter extends LlmAdapterBase<'completion'> {
  /**
   * The transport's endpoint when a provider names none. Metering inference reads it, so a provider with no base URL
   * still resolves to the account its transport's default endpoint bills.
   */
  readonly defaultBaseUrl?: WebsiteUrlWithPrefix;
  /**
   * Mint the strategy for one provider. Inert: no I/O.
   *
   * @param config - The provider, its effective base URL, the shared options and its account facets.
   * @returns The strategy, `id` = the provider's id.
   */
  make(config: LlmCompletionAdapterConfig): LlmStrategy;
}

/**
 * A DECISION adapter — keyed by decision route.
 *
 * Its `make` must register the strategy under the PROVIDER's id with `kind` = {@link strategyKind}, which is what a
 * call record reads to tell a decision row from a completion row. The resolver checks both.
 */
export interface LlmDecisionAdapter extends LlmAdapterBase<'decision'> {
  /**
   * The `kind` every strategy this adapter mints declares.
   */
  readonly strategyKind: LlmStrategyId;
  /**
   * The completion transports that serve this route when a provider declares no `decision` of its own. Absent ⇒ the
   * route is never derived; a provider must declare it.
   */
  readonly transports?: ReadonlyArray<LlmStrategyId>;
  /**
   * Mint the decision strategy for one provider. Inert: no I/O.
   *
   * @param config - The provider, its effective base URL and the shared timeout and fetch seam.
   * @returns The strategy, `id` = the provider's id, `kind` = {@link strategyKind}.
   */
  make(config: LlmDecisionAdapterConfig): LlmDecisionStrategy;
}

/**
 * A METERING adapter — keyed by metering id. It decides which providers bill the account it reads and mints the
 * account's status source.
 */
export interface LlmMeteringAdapter extends LlmAdapterBase<'metering'> {
  /**
   * What a metered provider's synchronous `cost` is (`'list'` = an upper bound at list price). Absent ⇒ the cost is
   * the billed amount.
   */
  readonly costBasis?: LlmCostBasis;
  /**
   * Whether a base URL is this account's endpoint — the inference for a provider that declared no `metering`. Must
   * PARSE the URL, never substring-match it: a look-alike host must not inherit someone else's quota.
   *
   * @param baseUrl - The provider's effective base URL.
   * @returns True when the URL is this account's endpoint.
   */
  isAccountBaseUrl?(baseUrl: WebsiteUrl): boolean;
  /**
   * Mint the account status source for one provider. Inert, and never throws: a source missing a host secret (a
   * management key) reports itself unavailable when read. Host secrets are closed over when the host builds the
   * adapter.
   *
   * @param input - The provider, its effective base URL and the fetch seam.
   * @returns The status source.
   */
  make(input: LlmAdapterConfig): LlmProviderStatusSource;
}

/**
 * A BILL adapter — keyed by metering id; mints the reader that fetches one call's settled bill.
 */
export interface LlmBillAdapter extends LlmAdapterBase<'bill'> {
  /**
   * Mint the bill reader for one provider. Inert: no I/O.
   *
   * @param input - The provider, its effective base URL and the fetch seam.
   * @returns The bill reader.
   */
  make(input: LlmAdapterConfig): LlmCallBillReader;
}

/**
 * A CREDENTIAL-PROBE adapter — keyed by metering id; mints the account's own key check, which replaces a transport's
 * generic one.
 */
export interface LlmCredentialProbeAdapter extends LlmAdapterBase<'credentialProbe'> {
  /**
   * Mint the credential probe for one provider. Inert: no I/O until the probe is called.
   *
   * @param input - The provider, its effective base URL and the fetch seam.
   * @returns The credential probe.
   */
  make(input: LlmAdapterConfig): LlmCredentialProbe;
}

/**
 * Any adapter.
 */
export type LlmAdapter = LlmCompletionAdapter | LlmDecisionAdapter | LlmMeteringAdapter | LlmBillAdapter | LlmCredentialProbeAdapter;

/**
 * The adapter type of one facet.
 */
export type LlmAdapterForFacet<F extends LlmAdapterFacet> = Extract<LlmAdapter, { readonly facet: F }>;
