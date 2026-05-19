/**
 * Vitest specs for the dispatcher → delegate caller-count credit table.
 *
 * Locks the resolution rule shared by `dbx_model_firebase_index_validate_app`
 * and `dbx_model_firebase_index_list_app`: every tagged
 * `@dbxModelFirebaseIndexDispatcher` folds its scanner reference count
 * into each delegate it routes into, so a dispatcher-only primitive does
 * not false-positive on `MODEL_FIREBASE_INDEX_UNUSED_FACTORY`.
 */

import { describe, expect, it } from 'vitest';
import { buildDispatcherCreditByName } from './model-firebase-index-dispatcher-credit.js';
import type { ModelFirebaseIndexDispatcherSummary } from '@dereekb/dbx-cli/firestore-indexes';
import type { FactoryReferenceCount } from './model-firebase-index-reference-scan.js';

function refs(productionCount: number, specCount: number): FactoryReferenceCount {
  return {
    count: productionCount + specCount,
    productionCount,
    specCount,
    referencedBy: []
  };
}

describe('buildDispatcherCreditByName', () => {
  it('returns an empty map when no dispatchers are present', () => {
    const result = buildDispatcherCreditByName([], new Map());
    expect(result.size).toBe(0);
  });

  it('credits every delegate with the dispatcher`s reference count', () => {
    const dispatchers: readonly ModelFirebaseIndexDispatcherSummary[] = [{ slug: 'jobs-dispatcher', name: 'jobsDispatcher', delegates: ['jobsByStatusQuery', 'jobsByPriorityQuery'] }];
    const references = new Map<string, FactoryReferenceCount>([['jobs-dispatcher', refs(3, 1)]]);

    const result = buildDispatcherCreditByName(dispatchers, references);

    expect(result.get('jobsByStatusQuery')).toEqual({ productionCount: 3, specCount: 1 });
    expect(result.get('jobsByPriorityQuery')).toEqual({ productionCount: 3, specCount: 1 });
  });

  it('sums credit when multiple dispatchers delegate to the same factory', () => {
    const dispatchers: readonly ModelFirebaseIndexDispatcherSummary[] = [
      { slug: 'jobs-dispatcher', name: 'jobsDispatcher', delegates: ['jobsByStatusQuery'] },
      { slug: 'jobs-other-dispatcher', name: 'jobsOtherDispatcher', delegates: ['jobsByStatusQuery'] }
    ];
    const references = new Map<string, FactoryReferenceCount>([
      ['jobs-dispatcher', refs(2, 0)],
      ['jobs-other-dispatcher', refs(5, 4)]
    ]);

    const result = buildDispatcherCreditByName(dispatchers, references);

    expect(result.get('jobsByStatusQuery')).toEqual({ productionCount: 7, specCount: 4 });
  });

  it('skips dispatchers with zero references — there is nothing to credit', () => {
    const dispatchers: readonly ModelFirebaseIndexDispatcherSummary[] = [{ slug: 'jobs-dispatcher', name: 'jobsDispatcher', delegates: ['jobsByStatusQuery'] }];
    const references = new Map<string, FactoryReferenceCount>([['jobs-dispatcher', refs(0, 0)]]);

    const result = buildDispatcherCreditByName(dispatchers, references);

    expect(result.has('jobsByStatusQuery')).toBe(false);
  });

  it('skips dispatchers missing from the reference map (treated as zero)', () => {
    const dispatchers: readonly ModelFirebaseIndexDispatcherSummary[] = [{ slug: 'jobs-dispatcher', name: 'jobsDispatcher', delegates: ['jobsByStatusQuery'] }];
    const references = new Map<string, FactoryReferenceCount>();

    const result = buildDispatcherCreditByName(dispatchers, references);

    expect(result.has('jobsByStatusQuery')).toBe(false);
  });

  it('emits no entries for a dispatcher whose `delegates` list is empty', () => {
    const dispatchers: readonly ModelFirebaseIndexDispatcherSummary[] = [{ slug: 'jobs-dispatcher', name: 'jobsDispatcher', delegates: [] }];
    const references = new Map<string, FactoryReferenceCount>([['jobs-dispatcher', refs(4, 1)]]);

    const result = buildDispatcherCreditByName(dispatchers, references);

    expect(result.size).toBe(0);
  });

  it('keeps the production and spec counts independent — a spec-only dispatcher only credits the spec column', () => {
    const dispatchers: readonly ModelFirebaseIndexDispatcherSummary[] = [{ slug: 'jobs-dispatcher', name: 'jobsDispatcher', delegates: ['jobsByStatusQuery'] }];
    const references = new Map<string, FactoryReferenceCount>([['jobs-dispatcher', refs(0, 2)]]);

    const result = buildDispatcherCreditByName(dispatchers, references);

    expect(result.get('jobsByStatusQuery')).toEqual({ productionCount: 0, specCount: 2 });
  });
});
