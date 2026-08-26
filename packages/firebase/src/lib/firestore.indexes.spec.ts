import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE, FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE, type FirestoreQueryConstraint, type OrderByQueryConstraintData, type WhereQueryConstraintData } from './common/firestore/query/constraint';
import { calendarIdentity } from './model/calendar/calendar';
import { calendarsDueForResyncQuery } from './model/calendar/calendar.query';
import { notificationIdentity } from './model/notification/notification';
import { notificationsPastSendAtTimeQuery } from './model/notification/notification.query';
import { oidcEntryIdentity } from './model/oidcmodel/oidcmodel';
import { oidcEntriesByUidQuery, oidcEntriesByUserCodeQuery } from './model/oidcmodel/oidcmodel.query';
import { storageFileIdentity } from './model/storagefile/storagefile';

/**
 * Guards the composite indexes this package's query factories require against the workspace
 * `firestore.indexes.json` that actually gets deployed.
 *
 * This exists because **the Firestore emulator does not enforce composite indexes**. Every integration
 * test can be green while production returns FAILED_PRECONDITION on the sweep's first page — which is
 * exactly what happened to the `nbn` index, created by hand in the console and never committed.
 *
 * Regenerate the file with `./regenerate-firestore-indexes.sh`.
 */
interface FirestoreIndexesJson {
  readonly indexes: { readonly collectionGroup: string; readonly queryScope: string; readonly fields: { readonly fieldPath: string; readonly order?: string }[] }[];
}

const indexesJson = JSON.parse(readFileSync(new URL('../../../../firestore.indexes.json', import.meta.url), 'utf8')) as FirestoreIndexesJson;

/**
 * The index a query needs, in `(field:op, …)` form. `__name__` is appended implicitly by Firestore, so
 * it is dropped here and compared separately against the generated file.
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

function generatedIndexFields(collectionName: string): string[] {
  return indexesJson.indexes.filter((index) => index.collectionGroup === collectionName).map((index) => index.fields.map((field) => `${field.fieldPath}:${(field.order ?? 'ASCENDING').toLowerCase().replace('ending', '')}`).join(', '));
}

function generatedIndexScopes(collectionName: string): string[] {
  return indexesJson.indexes.filter((index) => index.collectionGroup === collectionName).map((index) => index.queryScope);
}

describe('Notification query factories', () => {
  it('should require a composite for the send sweep, because equality + range cannot be index-merged', () => {
    // `d == false` plus a range on `sat` is the one shape Firestore's automatic single-field indexes
    // cannot serve. This index was live in production for a long time without ever being committed.
    expect(requiredIndexFor(notificationsPastSendAtTimeQuery(new Date()))).toBe('d:==, sat:<=');

    const generated = generatedIndexFields(notificationIdentity.collectionName);
    expect(generated).toContain('d:asc, sat:asc, __name__:asc');
    expect(generated).toHaveLength(1);
  });

  it('should scope the send-sweep index to the collection group', () => {
    // Notification is a subcollection of NotificationBox and the sweep runs across all of them, so a
    // COLLECTION-scoped index would not be used at all.
    expect(generatedIndexScopes(notificationIdentity.collectionName)).toEqual(['COLLECTION_GROUP']);
  });
});

describe('Calendar query factories', () => {
  it('should require a composite for the resync backstop', () => {
    expect(requiredIndexFor(calendarsDueForResyncQuery({ calendarType: 'demo_profile', before: new Date() }))).toBe('t:==, sat:<');

    const generated = generatedIndexFields(calendarIdentity.collectionName);
    expect(generated).toContain('t:asc, sat:asc, __name__:asc');
    expect(generated).toHaveLength(1);
  });
});

describe('equality-only query factories', () => {
  it('should need no composite index for the OIDC queries', () => {
    // Every oidc_e query is equality-only, which Firestore serves by merging the automatic single-field
    // indexes. Verified against production: OIDC runs with no oidc_e composite deployed at all.
    expect(requiredIndexFor(oidcEntriesByUidQuery('Grant', 'uid'))).toBe('type:==, uid:==');
    expect(requiredIndexFor(oidcEntriesByUserCodeQuery('DeviceCode', 'code'))).toBe('type:==, userCode:==');

    // The length assertion is the load-bearing one: it fails if the analyzer ever starts emitting
    // redundant equality-only composites again, which cost write latency for no query benefit.
    expect(generatedIndexFields(oidcEntryIdentity.collectionName)).toHaveLength(0);
  });

  it('should need no composite index for the StorageFile queries', () => {
    expect(generatedIndexFields(storageFileIdentity.collectionName)).toHaveLength(0);
  });
});
