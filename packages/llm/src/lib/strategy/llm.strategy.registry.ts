/**
 * The strategy registry: every configured strategy of one lane, keyed by its instance `id` — a completion
 * {@link LlmStrategy} registry by default, or a decision registry (`LlmDecisionStrategyRegistry`) from the same
 * factory, since both lanes extend {@link LlmStrategyBase}.
 */

import { createKeyedRegistry, type KeyedRegistry } from '@dereekb/util';
import { type LlmStrategyId } from '../model/llm.value';
import { type LlmStrategy, type LlmStrategyBase } from './llm.strategy';

/**
 * A {@link KeyedRegistry} of strategies of either lane, keyed by their instance `id`. Defaults to the completion lane.
 *
 * @typeParam S - The strategy type — {@link LlmStrategy}, or the decision lane's `LlmDecisionStrategy`.
 */
export type LlmStrategyRegistry<S extends LlmStrategyBase = LlmStrategy> = KeyedRegistry<S, LlmStrategyId>;

/**
 * Build an {@link LlmStrategyRegistry} for either lane, keyed by id with a last-wins policy (a re-registered id
 * replaces the value in its original slot), on the `@dereekb/util` {@link createKeyedRegistry} primitive. The seed's
 * type picks the lane: completion strategies build an `LlmStrategyRegistry`, decision strategies an
 * `LlmDecisionStrategyRegistry`.
 *
 * The registry answers `get(id)`. "Every instance of a transport" is {@link llmStrategyInstancesOfKind}
 * (`values().filter(...)` in registry order); "the last registered instance of a kind" is its `.at(-1)`. A host whose
 * default is "the first configured strategy" reads `values()[0]`.
 *
 * @param seed - The strategies to seed the registry with.
 * @returns The strategy registry.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmStrategyRegistry<S extends LlmStrategyBase = LlmStrategy>(seed: ReadonlyArray<S>): LlmStrategyRegistry<S> {
  return createKeyedRegistry<S, LlmStrategyId>({ readKey: (strategy) => strategy.id, seed });
}

/**
 * The TRANSPORT of one strategy, on either lane — {@link LlmStrategyBase.kind} when it declares one, else its
 * {@link LlmStrategyBase.id} (a single-instance strategy / a spec fake, where the two are the same string).
 *
 * The ONE place that default lives, so no reporter has to remember it.
 *
 * @param strategy - The strategy to read.
 * @returns The transport kind.
 */
export function llmStrategyKind(strategy: Pick<LlmStrategyBase, 'id' | 'kind'>): LlmStrategyId {
  return strategy.kind ?? strategy.id;
}

/**
 * Config for {@link llmStrategyInstancesOfKind}.
 *
 * @typeParam S - The strategy type of the registry.
 */
export interface LlmStrategyInstancesOfKindConfig<S extends LlmStrategyBase = LlmStrategy> {
  /**
   * The registry to scan — of either lane.
   */
  readonly strategies: LlmStrategyRegistry<S>;
  /**
   * The transport kind to match.
   */
  readonly kind: LlmStrategyId;
}

/**
 * Every registered INSTANCE of one transport kind, in registry order, on either lane. Its `.at(-1)` is the last
 * registered instance of the kind.
 *
 * @param config - The registry to scan and the kind to match.
 * @returns The matching instances (empty when none is registered).
 */
export function llmStrategyInstancesOfKind<S extends LlmStrategyBase = LlmStrategy>(config: LlmStrategyInstancesOfKindConfig<S>): ReadonlyArray<S> {
  const { strategies, kind } = config;
  return strategies.values().filter((strategy) => llmStrategyKind(strategy) === kind);
}
