/**
 * The **adapter registry** — every {@link LlmAdapter} a host registered, in ONE registry keyed `facet:kind` on the
 * `@dereekb/util` {@link KeyedRegistry} primitive, so a host registers a provider entry's adapters in one call and gets
 * `register` / `unregister` / `values` for free.
 *
 * Lookups are typed per facet ({@link llmAdapterOf}, {@link resolveLlmAdapter}), and the fail-loud one names the kinds
 * that ARE registered, so a provider naming an adapter nobody registered reads as a configuration error rather than a
 * silent fallback.
 */

import { createKeyedRegistry, type KeyedRegistry, type Maybe } from '@dereekb/util';
import { type LlmModelConfigSchemaConfig } from '../model/config/llm.model.config.schema';
import { type LlmStrategyId } from '../model/llm.value';
import { type LlmStrategyBase } from '../strategy/llm.strategy';
import { llmStrategyKind } from '../strategy/llm.strategy.registry';
import { type LlmAdapter, type LlmAdapterFacet, type LlmAdapterKind, type LlmAdapterOf, type LlmCompletionAdapter, type LlmDecisionAdapter } from './llm.adapter';

/**
 * The registry key of one adapter: `${facet}:${kind}`.
 */
export type LlmAdapterKey = `${LlmAdapterFacet}:${string}`;

/**
 * A {@link KeyedRegistry} of {@link LlmAdapter}, keyed by {@link llmAdapterKey}.
 */
export type LlmAdapterRegistry = KeyedRegistry<LlmAdapter, LlmAdapterKey>;

/**
 * The registry key of one adapter.
 *
 * @param adapter - The adapter (only its `facet` and `kind` are read).
 * @returns `${facet}:${kind}`.
 */
export function llmAdapterKey(adapter: Pick<LlmAdapter, 'facet' | 'kind'>): LlmAdapterKey {
  return `${adapter.facet}:${adapter.kind}`;
}

/**
 * Build an {@link LlmAdapterRegistry} on the `@dereekb/util` {@link createKeyedRegistry} primitive.
 *
 * Collisions THROW: two provider entries claiming one transport would otherwise route it to whichever registered last.
 * Re-registering the same adapter instance stays an idempotent no-op.
 *
 * @param seed - The adapters to register, in order (registration order is the order every list reader returns).
 * @returns The adapter registry.
 * @throws {Error} When two different adapters claim one facet and kind.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmAdapterRegistry(seed: ReadonlyArray<LlmAdapter>): LlmAdapterRegistry {
  return createKeyedRegistry<LlmAdapter, LlmAdapterKey>({
    readKey: llmAdapterKey,
    throwOnDuplicateKey: (_key, value) => new Error(`a ${value.facet} adapter is already registered for '${value.kind}'; register each facet and kind once.`),
    seed
  });
}

/**
 * Config naming one facet of a registry.
 */
export interface LlmAdapterFacetConfig<F extends LlmAdapterFacet = LlmAdapterFacet> {
  /**
   * The registry to read.
   */
  readonly adapters: LlmAdapterRegistry;
  /**
   * The facet to read.
   */
  readonly facet: F;
}

/**
 * Config for {@link llmAdapterOf}.
 */
export interface LlmAdapterLookupConfig<F extends LlmAdapterFacet = LlmAdapterFacet> extends LlmAdapterFacetConfig<F> {
  /**
   * The transport, decision route or metering id to look up.
   */
  readonly kind: LlmAdapterKind;
}

/**
 * Config for {@link resolveLlmAdapter}.
 */
export interface ResolveLlmAdapterConfig<F extends LlmAdapterFacet = LlmAdapterFacet> extends LlmAdapterLookupConfig<F> {
  /**
   * Prefixes the error, e.g. `provider 'local'`.
   */
  readonly label?: Maybe<string>;
}

/**
 * The adapter registered for one facet and kind, or `undefined`.
 *
 * @param config - The registry, facet and kind.
 * @returns The adapter, or `undefined` when none is registered.
 */
export function llmAdapterOf<F extends LlmAdapterFacet>(config: LlmAdapterLookupConfig<F>): Maybe<LlmAdapterOf<F>> {
  const { adapters, facet, kind } = config;
  // Safe: the key embeds the facet, so whatever is registered under it is an adapter of that facet.
  return adapters.get(llmAdapterKey({ facet, kind })) as Maybe<LlmAdapterOf<F>>;
}

/**
 * The adapter registered for one facet and kind — FAIL-LOUD, naming the kinds registered for that facet.
 *
 * @param config - The registry, facet, kind and an optional error label.
 * @returns The adapter.
 * @throws {Error} When no adapter is registered for the facet and kind.
 */
export function resolveLlmAdapter<F extends LlmAdapterFacet>(config: ResolveLlmAdapterConfig<F>): LlmAdapterOf<F> {
  const adapter = llmAdapterOf(config);

  if (adapter == null) {
    const { adapters, facet, kind, label } = config;
    const kinds = llmAdapterKindsOf({ adapters, facet });
    const prefix = label == null ? '' : `${label}: `;
    throw new Error(`${prefix}no ${facet} adapter is registered for '${kind}' (registered: ${kinds.join(', ') || 'none'}).`);
  }

  return adapter;
}

/**
 * Config for {@link checkLlmAdapterStrategy}.
 */
export interface CheckLlmAdapterStrategyConfig<S extends LlmStrategyBase> {
  /**
   * The error prefix, e.g. `provider 'gateway'`.
   */
  readonly label: string;
  /**
   * The adapter that minted the strategy.
   */
  readonly adapter: LlmCompletionAdapter | LlmDecisionAdapter;
  /**
   * The provider the strategy was minted for.
   */
  readonly providerId: LlmStrategyId;
  /**
   * The minted strategy.
   */
  readonly strategy: S;
}

/**
 * Check a strategy an adapter just minted. It must carry the provider's own id (a strategy minted under the transport name
 * would make every second instance of that transport silently replace the first), and a decision adapter's strategy must
 * be of the kind the adapter declares (`strategyKind`).
 *
 * @param config - The label, the adapter, the provider id and the minted strategy.
 * @returns The strategy, unchanged.
 * @throws {Error} When the id, or a decision strategy's kind, does not match.
 */
export function checkLlmAdapterStrategy<S extends LlmStrategyBase>(config: CheckLlmAdapterStrategyConfig<S>): S {
  const { label, adapter, providerId, strategy } = config;

  if (strategy.id !== providerId) {
    throw new Error(`${label}: the '${adapter.kind}' ${adapter.facet} adapter minted strategy id '${strategy.id}'; an adapter must register each provider under the provider's own id.`);
  }

  if (adapter.facet === 'decision') {
    const kind = llmStrategyKind(strategy);

    if (kind !== adapter.strategyKind) {
      throw new Error(`${label}: the '${adapter.kind}' decision adapter minted a strategy of kind '${kind}' but declares strategyKind '${adapter.strategyKind}'.`);
    }
  }

  return strategy;
}

/**
 * Every adapter of one facet, in registration order.
 *
 * @param config - The registry and facet.
 * @returns The adapters (empty when none is registered).
 */
export function llmAdaptersOf<F extends LlmAdapterFacet>(config: LlmAdapterFacetConfig<F>): ReadonlyArray<LlmAdapterOf<F>> {
  const { adapters, facet } = config;
  return adapters.values().filter((adapter): adapter is LlmAdapterOf<F> => adapter.facet === facet);
}

/**
 * The kinds registered for one facet, in registration order.
 *
 * @param config - The registry and facet.
 * @returns The kinds (empty when none is registered).
 */
export function llmAdapterKindsOf(config: LlmAdapterFacetConfig): ReadonlyArray<LlmAdapterKind> {
  return llmAdaptersOf(config).map((adapter) => adapter.kind);
}

/**
 * The lists a model config schema reads from the registered adapters.
 */
export type LlmModelConfigLists = Pick<LlmModelConfigSchemaConfig, 'transports' | 'meterings' | 'decisionRoutes'>;

/**
 * The `transports`, `meterings` and `decisionRoutes` a model config schema accepts — the completion, metering and
 * decision kinds registered, each in registration order. Spread it into `makeLlmModelConfigSchema`, so a provider
 * entry can only name what a registered adapter serves.
 *
 * A builder here rather than an option on `makeLlmModelConfigSchema`, so the model config never imports the adapter
 * layer. An extension's own meterings still append through the extension.
 *
 * @param adapters - The adapter registry.
 * @returns The three lists.
 */
export function llmModelConfigListsOf(adapters: LlmAdapterRegistry): LlmModelConfigLists {
  return {
    transports: llmAdapterKindsOf({ adapters, facet: 'completion' }),
    meterings: llmAdapterKindsOf({ adapters, facet: 'metering' }),
    decisionRoutes: llmAdapterKindsOf({ adapters, facet: 'decision' })
  };
}
