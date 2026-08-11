import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE, FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE, type FirestoreQueryConstraint, type OrderByQueryConstraintData, type WhereQueryConstraintData } from '@dereekb/firebase';
import { openRouterRunTaskIdentity } from './openrouter.runtask';
import { openRouterRunTasksExpiredQuery, openRouterRunTasksForPromptQuery, openRouterRunTasksReclaimableQuery, openRouterRunTasksRunnableByPriorityQuery, openRouterRunTasksRunnableByQueuedAtQuery, openRouterRunTasksRunnableQuery } from './openrouter.query';

/**
 * The generated index file shipped with this package, which a consuming app merges into its own
 * `firestore.indexes.json`.
 *
 * Regenerate with:
 * `dbx-cli-generate-firestore-indexes --component packages/openrouter/firebase --output packages/openrouter/firebase/firestore.indexes.json`
 */
interface FirestoreIndexesJson {
  readonly indexes: { readonly collectionGroup: string; readonly queryScope: string; readonly fields: { readonly fieldPath: string; readonly order?: string }[] }[];
}

const indexesJson = JSON.parse(readFileSync(new URL('../../firestore.indexes.json', import.meta.url), 'utf8')) as FirestoreIndexesJson;

/**
 * The composite index a query needs, in `(field:direction, …)` form.
 *
 * Firestore needs a composite index for every equality/`in` filter plus every ordered field. `__name__`
 * is appended implicitly by Firestore, so it is dropped here and compared separately against the
 * generated file.
 */
function requiredIndexFor(constraints: FirestoreQueryConstraint[]): string {
  const equalityFields: string[] = [];
  const orderedFields: string[] = [];

  constraints.forEach((constraint) => {
    switch (constraint.type) {
      case FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE: {
        const data = constraint.data as WhereQueryConstraintData;
        equalityFields.push(`${String(data.fieldPath)}:${data.opStr}`);
        break;
      }
      case FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE: {
        const data = constraint.data as OrderByQueryConstraintData;
        orderedFields.push(`${String(data.fieldPath)}:${data.directionStr ?? 'asc'}`);
        break;
      }
      case FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE:
      default:
        break;
    }
  });

  return [...equalityFields, ...orderedFields].join(', ');
}

function generatedIndexFields(): string[] {
  return indexesJson.indexes.filter((index) => index.collectionGroup === openRouterRunTaskIdentity.collectionName).map((index) => index.fields.map((field) => `${field.fieldPath}:${(field.order ?? 'ASCENDING').toLowerCase().replace('ending', '')}`).join(', '));
}

describe('OpenRouterRunTask query factories', () => {
  it('should collapse the runnable dispatcher onto one of the two page queries', () => {
    expect(requiredIndexFor(openRouterRunTasksRunnableQuery({ limit: 5 }))).toBe(requiredIndexFor(openRouterRunTasksRunnableByQueuedAtQuery({ limit: 5 })));
    expect(requiredIndexFor(openRouterRunTasksRunnableQuery({ limit: 5, usePriorityOrder: true }))).toBe(requiredIndexFor(openRouterRunTasksRunnableByPriorityQuery({ limit: 5 })));
  });

  it('should require the documented composite index per query', () => {
    // Pinned literally rather than derived, so a change to any query factory has to be a deliberate
    // change to the index set a deployment needs — not a silent one.
    expect(requiredIndexFor(openRouterRunTasksRunnableByQueuedAtQuery({ limit: 5 }))).toBe('s:in, qat:asc');
    expect(requiredIndexFor(openRouterRunTasksRunnableByPriorityQuery({ limit: 5 }))).toBe('s:in, pr:asc, qat:asc');
    expect(requiredIndexFor(openRouterRunTasksReclaimableQuery({ limit: 5, leaseCutoff: new Date() }))).toBe('s:==, lat:<=, lat:asc');
    expect(requiredIndexFor(openRouterRunTasksForPromptQuery({ promptKey: 'p', limit: 5 }))).toBe('pk:==, qat:desc');
    // A single-field range with a matching order needs only Firestore's automatic single-field index.
    expect(requiredIndexFor(openRouterRunTasksExpiredQuery({ before: new Date(), limit: 5 }))).toBe('x:<=, x:asc');
  });

  it('should have every sweep index present in the generated indexes file', () => {
    // The emulator does NOT enforce composite indexes, so a green drain test proves nothing about
    // production — where a missing composite is a 400 on the sweep's very first page. This is the only
    // assertion in the suite that covers that gap.
    const generated = generatedIndexFields();

    expect(generated).toContain('s:asc, qat:asc, __name__:asc');
    expect(generated).toContain('s:asc, pr:asc, qat:asc, __name__:asc');
    expect(generated).toContain('s:asc, lat:asc, __name__:asc');
    expect(generated).toContain('pk:asc, qat:desc, __name__:desc');
  });

  it('should compare dates as ISO strings, because that is how firestoreDate persists them', () => {
    // A bare `where('lat', '<=', someDate)` compares a string field to a timestamp and matches NOTHING —
    // silently, returning an empty page that reads exactly like "no crashed sweeps to recover".
    const cutoff = new Date('2026-01-01T00:00:00.000Z');
    const constraints = openRouterRunTasksReclaimableQuery({ limit: 5, leaseCutoff: cutoff });
    const leaseFilter = constraints.map((x) => x.data as WhereQueryConstraintData).find((x) => x?.fieldPath === 'lat');

    expect(leaseFilter?.value).toBe('2026-01-01T00:00:00.000Z');
    expect(typeof leaseFilter?.value).toBe('string');
  });
});
