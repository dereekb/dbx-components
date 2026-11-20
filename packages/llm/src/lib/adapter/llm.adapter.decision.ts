/**
 * **Which of a host's providers can serve a DECISION — a derivation, not a declaration.**
 *
 * The decision lane adds no provider concept and no secret. It asks one question of the providers a host already
 * resolved: *does this provider serve a decision route, and does its key resolve?* The route is the provider's DECLARED
 * `decision`, else the route a registered decision adapter serves for the provider's transport — never sniffed from
 * its base URL (an `openai`-transport provider pointed at a gateway URL that also serves decisions does not thereby
 * serve them).
 *
 * A capable provider builds the decision strategy its route's adapter mints, and the capable set is ORDERED by the
 * host's route preference (default: decision adapter registration order), provider order within a route. The FIRST
 * entry is the provider a lane with no explicit pick routes to.
 *
 * An EMPTY registry is the honest answer for a run with no decision route at all: the lane then has no backend, and
 * every consumer falls through to its text arm. The completion registry and its routing are untouched; the decision
 * registry is built from the subset that qualifies.
 */

import { isNotBlankString, type Maybe, type MaybeMap } from '@dereekb/util';
import { type LlmStrategyId } from '../model/llm.value';
import { LLM_PROVIDER_FACET_NONE, type LlmCompletionProviderEntry } from '../model/config/llm.model.config.schema';
import { type LlmProviderConfig } from '../model/config/llm.model.config.resolve';
import { type LlmDecisionStrategy, type LlmDecisionStrategyRegistry } from '../decision/llm.decision.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmDecisionAdapterConfig } from './llm.adapter';
import { checkLlmAdapterStrategy, filterLlmAdaptersByFacet, resolveLlmAdapter, type LlmAdapterRegistry } from './llm.adapter.registry';
import { resolveLlmProviderBaseUrl, type LlmProviderAdaptersConfig } from './llm.adapter.provider';

/**
 * The decision route one provider serves — its DECLARED `decision`, else the kind of the first registered decision
 * adapter whose `transports` lists the provider's transport, else {@link LLM_PROVIDER_FACET_NONE}. Never derived from
 * the base URL.
 *
 * @param config - The provider (its `transport` and `decision`) and the registry.
 * @returns The route, `'none'` when the provider cannot serve a decision.
 */
export function resolveLlmProviderDecisionRoute(config: LlmProviderAdaptersConfig<Pick<LlmCompletionProviderEntry, 'transport' | 'decision'>>): LlmStrategyId {
  const { provider, adapters } = config;
  return provider.decision ?? filterLlmAdaptersByFacet({ adapters, facet: 'decision' }).find((adapter) => adapter.transports?.includes(provider.transport))?.kind ?? LLM_PROVIDER_FACET_NONE;
}

/**
 * Config for {@link llmDecisionCapableProviders}.
 */
export interface LlmDecisionCapableProvidersConfig<P extends LlmProviderConfig = LlmProviderConfig> {
  /**
   * Every resolved provider — the same list the completion strategies are built from.
   */
  readonly providers: Maybe<ReadonlyArray<P>>;
  /**
   * The registered adapters.
   */
  readonly adapters: LlmAdapterRegistry;
  /**
   * The order decision routes are preferred in when several providers can serve one. Default: the decision adapters'
   * registration order. A route the preference does not list ranks after every listed one.
   */
  readonly routePreference?: Maybe<ReadonlyArray<LlmStrategyId>>;
}

/**
 * The providers that CAN serve a decision — a decision route ({@link resolveLlmProviderDecisionRoute}) and a non-empty key
 * — ordered by route preference, provider order within a route (a STABLE sort). The FIRST entry is the lane's default.
 *
 * @param config - The providers, the registry and the optional route preference.
 * @returns The decision-capable subset, in preference order.
 */
export function llmDecisionCapableProviders<P extends LlmProviderConfig>(config: LlmDecisionCapableProvidersConfig<P>): ReadonlyArray<P> {
  const { providers, adapters, routePreference } = config;
  const preference = routePreference ?? filterLlmAdaptersByFacet({ adapters, facet: 'decision' }).map((adapter) => adapter.kind);
  const routed = (providers ?? []).map((provider) => ({ provider, route: resolveLlmProviderDecisionRoute({ provider, adapters }) })).filter(({ provider, route }) => route !== LLM_PROVIDER_FACET_NONE && isNotBlankString(provider.apiKey));
  const rank = (route: LlmStrategyId): number => {
    const index = preference.indexOf(route);
    return index === -1 ? preference.length : index;
  };

  return routed.sort((left, right) => rank(left.route) - rank(right.route)).map(({ provider }) => provider);
}

/**
 * Config for {@link makeLlmDecisionStrategies}.
 */
export interface MakeLlmDecisionStrategiesConfig extends LlmDecisionCapableProvidersConfig, Partial<MaybeMap<Pick<LlmDecisionAdapterConfig, 'timeoutMs' | 'fetch'>>> {}

/**
 * Build the decision-strategy registry from the providers a host already resolved.
 *
 * Each capable provider keeps its OWN id as the strategy id (so two keys on one gateway stay two billable backends)
 * and declares its route's `strategyKind` — what a call record reads to tell the decision lane from the completion lane
 * sharing its key. Registration order is {@link llmDecisionCapableProviders}' preference order, so "first registered"
 * is the preferred backend.
 *
 * @param config - The providers, the registry, the route preference and the shared timeout and fetch seam.
 * @returns The registry, empty when no provider can serve a decision. Inert: no I/O.
 * @throws {Error} When a provider's route has no registered decision adapter, or an adapter mints a strategy under
 *   another id or of another kind than it declares.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmDecisionStrategies(config: MakeLlmDecisionStrategiesConfig): LlmDecisionStrategyRegistry {
  const { adapters, timeoutMs, fetch } = config;

  const built = llmDecisionCapableProviders(config).map((provider): LlmDecisionStrategy => {
    const label = `provider '${provider.id}'`;
    const route = resolveLlmProviderDecisionRoute({ provider, adapters });
    const adapter = resolveLlmAdapter({ adapters, facet: 'decision', kind: route, label });
    const baseUrl = resolveLlmProviderBaseUrl({ provider, adapters });
    const strategy = adapter.make({ provider, ...(baseUrl == null ? {} : { baseUrl }), ...(fetch == null ? {} : { fetch }), ...(timeoutMs == null ? {} : { timeoutMs }) });
    return checkLlmAdapterStrategy({ label, adapter, providerId: provider.id, strategy });
  });

  return makeLlmStrategyRegistry(built);
}

/**
 * Every strategy kind a decision strategy can carry — what a call-record reader tests to tell a decision row from a
 * completion row (a reader should ALSO accept the row's `decision` id). Derived from the registered decision adapters,
 * so a new gateway is a new adapter rather than a silent misclassification in every reader.
 *
 * @param adapters - The adapter registry.
 * @returns The decision strategy kinds.
 */
export function readLlmDecisionStrategyKinds(adapters: LlmAdapterRegistry): ReadonlySet<LlmStrategyId> {
  return new Set(filterLlmAdaptersByFacet({ adapters, facet: 'decision' }).map((adapter) => adapter.strategyKind));
}
