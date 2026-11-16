/**
 * The strategy registry: every configured {@link LlmStrategy}, keyed by its instance `id` and indexed by its
 * transport `kind`.
 */

import { type LlmStrategyId } from '../model/llm.value';
import { createKeyedRegistry, type KeyedRegistry } from '../util/keyed.registry';
import { type LlmStrategy } from './llm.strategy';

/**
 * A {@link KeyedRegistry} of {@link LlmStrategy}, with an `'id'` primary index and a `'kind'` secondary index.
 */
export type LlmStrategyRegistry = KeyedRegistry<LlmStrategy, LlmStrategyId>;

/**
 * Build an {@link LlmStrategyRegistry} keyed by id with a last-wins (`'replace'`) policy, on the shared
 * {@link createKeyedRegistry} primitive.
 *
 * Besides `get(id)`, the registry answers `getBy('kind', kind)`: "give me AN instance of this transport" — the last
 * registered live one (a kind-shaped lookup, such as a default strategy configured by transport name, means exactly
 * that). It can never answer "all of them"; a caller that needs every instance of a kind reads
 * {@link llmStrategyInstancesOfKind}.
 *
 * @param seed - The strategies to seed the registry with.
 * @returns The strategy registry.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmStrategyRegistry(seed: ReadonlyArray<LlmStrategy>): LlmStrategyRegistry {
  return createKeyedRegistry<LlmStrategy, LlmStrategyId>({
    indexes: [
      { name: 'id', keyOf: (strategy) => strategy.id },
      // The secondary TRANSPORT index. Deliberately LAST-WINS (`collision: 'replace'` applies to every index): its
      // entry points at the last registered instance of the kind, and falls back to the remaining ones when that
      // instance is replaced or removed.
      { name: 'kind', keyOf: llmStrategyKind }
    ],
    collision: 'replace',
    seed
  });
}

/**
 * The TRANSPORT of one strategy — {@link LlmStrategy.kind} when it declares one, else its {@link LlmStrategy.id} (a
 * single-instance strategy / a spec fake, where the two are the same string).
 *
 * The ONE place that default lives, so no reporter has to remember it.
 *
 * @param strategy - The strategy to read.
 * @returns The transport kind.
 */
export function llmStrategyKind(strategy: LlmStrategy): LlmStrategyId {
  return strategy.kind ?? strategy.id;
}

/**
 * Config for {@link llmStrategyInstancesOfKind}.
 */
export interface LlmStrategyInstancesOfKindConfig {
  /**
   * The registry to scan.
   */
  readonly strategies: LlmStrategyRegistry;
  /**
   * The transport kind to match.
   */
  readonly kind: LlmStrategyId;
}

/**
 * Every registered INSTANCE of one transport kind, in registry order — the "all of them" answer the last-wins
 * `'kind'` index structurally cannot give.
 *
 * @param config - The registry to scan and the kind to match.
 * @returns The matching instances (empty when none is registered).
 */
export function llmStrategyInstancesOfKind(config: LlmStrategyInstancesOfKindConfig): ReadonlyArray<LlmStrategy> {
  const { strategies, kind } = config;
  return strategies.values().filter((strategy) => llmStrategyKind(strategy) === kind);
}
