/**
 * Dispatcher → delegate caller-count credit table.
 *
 * Folds {@link FactoryReferenceCount}s for every tagged
 * `@dbxModelFirebaseIndexDispatcher` into every factory the dispatcher
 * delegates to by name. Consumed by `dbx_model_firebase_index_validate_app`
 * and `dbx_model_firebase_index_list_app` so a primitive that is only
 * reached through a dispatcher does not perpetually false-positive on
 * `MODEL_FIREBASE_INDEX_UNUSED_FACTORY`.
 *
 * Lives in `scan/` (not under either tool) so the validator and list-app
 * tools share a single resolution rule.
 */

import type { ModelFirebaseIndexDispatcherSummary } from '@dereekb/dbx-cli/firestore-indexes';
import type { FactoryReferenceCount } from './model-firebase-index-reference-scan.js';

/**
 * Reference credit routed to one delegated factory through one or more
 * dispatchers. Summed across every dispatcher whose body delegates to the
 * factory.
 */
export interface DispatcherCredit {
  readonly productionCount: number;
  readonly specCount: number;
}

/**
 * Builds the dispatcher → delegate credit table.
 *
 * For each summary in `dispatcherSummaries`, resolves the dispatcher's
 * own scanner reference count (by slug) and folds it into every name in
 * the dispatcher's `delegates` list. Dispatchers with zero references
 * contribute nothing — there is nothing to credit. Multiple dispatchers
 * delegating to the same factory sum their counts.
 *
 * @param dispatcherSummaries - Dispatcher entries surfaced by the build outcome.
 * @param references - Per-slug reference counts from {@link scanFactoryReferences}.
 * @returns Map keyed by delegate factory `name`.
 *
 * @example
 * ```ts
 * const creditByName = buildDispatcherCreditByName(buildOutcome.dispatcherSummaries, references);
 * const credit = creditByName.get(entry.name);
 * if ((references.get(entry.slug)?.productionCount ?? 0) + (credit?.productionCount ?? 0) === 0) {
 *   // emit MODEL_FIREBASE_INDEX_UNUSED_FACTORY
 * }
 * ```
 */
export function buildDispatcherCreditByName(dispatcherSummaries: readonly ModelFirebaseIndexDispatcherSummary[], references: ReadonlyMap<string, FactoryReferenceCount>): ReadonlyMap<string, DispatcherCredit> {
  const out = new Map<string, { productionCount: number; specCount: number }>();
  for (const dispatcher of dispatcherSummaries) {
    const refs = references.get(dispatcher.slug);
    const productionCount = refs?.productionCount ?? 0;
    const specCount = refs?.specCount ?? 0;
    if (productionCount === 0 && specCount === 0) continue;
    for (const delegate of dispatcher.delegates) {
      const existing = out.get(delegate) ?? { productionCount: 0, specCount: 0 };
      existing.productionCount += productionCount;
      existing.specCount += specCount;
      out.set(delegate, existing);
    }
  }
  return out;
}
