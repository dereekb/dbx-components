/**
 * The strategy registry: every configured {@link LlmStrategy}, keyed by its instance `id`.
 */

import { createKeyedRegistry, type KeyedRegistry } from '@dereekb/util';
import { type LlmStrategyId } from '../model/llm.value';
import { type LlmStrategy } from './llm.strategy';

/**
 * A {@link KeyedRegistry} of {@link LlmStrategy}, keyed by its instance `id`.
 */
export type LlmStrategyRegistry = KeyedRegistry<LlmStrategy, LlmStrategyId>;

/**
 * Build an {@link LlmStrategyRegistry} keyed by id with a last-wins policy (a re-registered id replaces the value in its
 * original slot), on the `@dereekb/util` {@link createKeyedRegistry} primitive.
 *
 * The registry answers `get(id)`. "Every instance of a transport" is {@link llmStrategyInstancesOfKind}
 * (`values().filter(...)` in registry order); "the last registered instance of a kind" is its `.at(-1)`.
 *
 * @param seed - The strategies to seed the registry with.
 * @returns The strategy registry.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmStrategyRegistry(seed: ReadonlyArray<LlmStrategy>): LlmStrategyRegistry {
  return createKeyedRegistry<LlmStrategy, LlmStrategyId>({ readKey: (strategy) => strategy.id, seed });
}

/**
 * The TRANSPORT of one strategy — {@link LlmStrategy.kind} when it declares one, else its {@link LlmStrategy.id} (a
 * single-instance strategy / a spec fake, where the two are the same string).
 *
 * The ONE place that default lives, so no reporter has to remember it. Completion and decision strategies share the
 * rule, so it reads only the `id` and `kind` both carry.
 *
 * @param strategy - The strategy to read.
 * @returns The transport kind.
 */
export function llmStrategyKind(strategy: Pick<LlmStrategy, 'id' | 'kind'>): LlmStrategyId {
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
 * Every registered INSTANCE of one transport kind, in registry order. Its `.at(-1)` is the last registered instance
 * of the kind.
 *
 * @param config - The registry to scan and the kind to match.
 * @returns The matching instances (empty when none is registered).
 */
export function llmStrategyInstancesOfKind(config: LlmStrategyInstancesOfKindConfig): ReadonlyArray<LlmStrategy> {
  const { strategies, kind } = config;
  return strategies.values().filter((strategy) => llmStrategyKind(strategy) === kind);
}
