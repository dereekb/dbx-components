import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE, FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE, type FirestoreQueryConstraint, type OrderByQueryConstraintData, type WhereQueryConstraintData } from '@dereekb/firebase';
import { OpenRouterPromptState, openRouterPromptIdentity, openRouterRunTaskIdentity } from './openrouter.model';
import { openRouterPromptsWithStateQuery, openRouterRunTasksExpiredQuery, openRouterRunTasksReclaimableQuery, openRouterRunTasksRunnableQuery } from './openrouter.query';

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

function generatedIndexFields(collectionName: string = openRouterRunTaskIdentity.collectionName): string[] {
  return indexesJson.indexes.filter((index) => index.collectionGroup === collectionName).map((index) => index.fields.map((field) => `${field.fieldPath}:${(field.order ?? 'ASCENDING').toLowerCase().replace('ending', '')}`).join(', '));
}

describe('OpenRouterPrompt query factories', () => {
  it('should need no composite index at all', () => {
    // One equality filter and no ordering, so Firestore serves it from the automatic single-field index
    // and pagination falls through to the implicit `__name__` order — which for this model is the
    // prompt's own readable key. A second filter axis or an explicit orderBy is what would buy the first
    // composite on `orp`, and this is the assertion that would notice.
    expect(requiredIndexFor(openRouterPromptsWithStateQuery({ state: OpenRouterPromptState.ACTIVE }))).toBe('s:==');
    expect(generatedIndexFields(openRouterPromptIdentity.collectionName)).toHaveLength(0);
  });
});

describe('OpenRouterRunTask query factories', () => {
  it('should require the documented composite index per query', () => {
    // Pinned literally rather than derived, so a change to any query factory has to be a deliberate
    // change to the index set a deployment needs — not a silent one.
    expect(requiredIndexFor(openRouterRunTasksRunnableQuery({ limit: 5 }))).toBe('s:in, qat:asc');
    expect(requiredIndexFor(openRouterRunTasksReclaimableQuery({ limit: 5, leaseCutoff: new Date() }))).toBe('s:==, lat:<=, lat:asc');
    // A single-field range with a matching order needs only Firestore's automatic single-field index.
    expect(requiredIndexFor(openRouterRunTasksExpiredQuery({ before: new Date(), limit: 5 }))).toBe('qat:<=, qat:asc');
  });

  it('should need exactly two composite indexes, and no more', () => {
    // The emulator does NOT enforce composite indexes, so a green drain test proves nothing about
    // production — where a missing composite is a 400 on the sweep's very first page. This is the only
    // assertion in the suite that covers that gap.
    const generated = generatedIndexFields();

    expect(generated).toContain('s:asc, qat:asc, __name__:asc');
    expect(generated).toContain('s:asc, lat:asc, __name__:asc');
    // The length assertion is what defends the index economy: `toContain` alone would let a re-added query
    // factory quietly buy a third composite and stay green.
    expect(generated).toHaveLength(2);
  });

  it('should need no composite index at all for the retention query', () => {
    // `qat:<=` ordered by `qat` is a single-field range with a matching order, which Firestore serves from
    // its automatic single-field index. Nothing to generate, nothing to deploy.
    const generated = generatedIndexFields();
    expect(generated.some((x) => x.startsWith('qat:'))).toBe(false);
  });

  it('should compare dates as ISO strings, because that is how firestoreDate persists them', () => {
    // A bare `where('lat', '<=', someDate)` compares a string field to a timestamp and matches NOTHING —
    // silently, returning an empty page that reads exactly like "no crashed sweeps to recover".
    const cutoff = new Date('2026-01-01T00:00:00.000Z');
    const leaseFilter = openRouterRunTasksReclaimableQuery({ limit: 5, leaseCutoff: cutoff })
      .map((x) => x.data as WhereQueryConstraintData)
      .find((x) => x?.fieldPath === 'lat');

    expect(leaseFilter?.value).toBe('2026-01-01T00:00:00.000Z');
    expect(typeof leaseFilter?.value).toBe('string');

    // …and the retention cutoff has exactly the same requirement, which is also why Firestore's native TTL
    // policy cannot be pointed at `qat`: a TTL only deletes on a `Timestamp` field.
    const expirationFilter = openRouterRunTasksExpiredQuery({ before: cutoff, limit: 5 })
      .map((x) => x.data as WhereQueryConstraintData)
      .find((x) => x?.fieldPath === 'qat');

    expect(expirationFilter?.value).toBe('2026-01-01T00:00:00.000Z');
    expect(typeof expirationFilter?.value).toBe('string');
  });
});
