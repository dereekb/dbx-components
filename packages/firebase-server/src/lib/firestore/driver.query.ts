import { type DocumentSnapshot, FieldPath, type Query as GoogleCloudQuery, type Transaction as GoogleCloudTransaction } from '@google-cloud/firestore';
import {
  type Query,
  FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE,
  type FullFirestoreQueryConstraintHandlersMapping,
  makeFirestoreQueryConstraintFunctionsDriver,
  type QuerySnapshot,
  type FirestoreQueryConstraintFunctionsDriver,
  type FirestoreQueryDriver,
  FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE,
  streamFromOnSnapshot,
  type Transaction,
  FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE
} from '@dereekb/firebase';

/**
 * Server-side query builder type, aliasing the Google Cloud Firestore {@link Query}.
 */
export type FirestoreServerQueryBuilder<T = any> = GoogleCloudQuery<T>;

/**
 * Maps each abstract query constraint type to its Google Cloud Firestore implementation.
 *
 * Used by {@link firestoreClientQueryConstraintFunctionsDriver} to build the server-side query driver.
 */
export const FIRESTORE_CLIENT_QUERY_CONSTRAINT_HANDLER_MAPPING: FullFirestoreQueryConstraintHandlersMapping<FirestoreServerQueryBuilder> = {
  [FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.limit(data.limit),
  [FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.limitToLast(data.limit),
  [FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.orderBy(data.fieldPath, data.directionStr),
  [FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.orderBy(FieldPath.documentId(), data.directionStr),
  [FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.where(data.fieldPath, data.opStr, data.value),
  [FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.where(FieldPath.documentId(), data.opStr, data.value),
  [FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.offset(data.offset),
  [FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.startAt(data.snapshot as DocumentSnapshot),
  [FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.startAt(...data.fieldValues),
  [FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.startAfter(data.snapshot as DocumentSnapshot),
  [FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.endAt(data.snapshot as DocumentSnapshot),
  [FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.endAt(...data.fieldValues),
  [FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.endBefore(data.snapshot as DocumentSnapshot)
};

/**
 * Creates a {@link FirestoreQueryConstraintFunctionsDriver} for the Google Cloud Firestore server SDK.
 *
 * Translates abstract query constraints into Google Cloud Firestore query builder calls.
 *
 * @returns A {@link FirestoreQueryConstraintFunctionsDriver} for the server SDK.
 */
export function firestoreClientQueryConstraintFunctionsDriver(): FirestoreQueryConstraintFunctionsDriver {
  return makeFirestoreQueryConstraintFunctionsDriver<FirestoreServerQueryBuilder>({
    mapping: FIRESTORE_CLIENT_QUERY_CONSTRAINT_HANDLER_MAPPING,
    init: <T>(query: Query<T>) => query as FirestoreServerQueryBuilder<T>,
    build: <T>(query: FirestoreServerQueryBuilder<T>) => query,
    documentIdFieldPath: () => FieldPath.documentId()
  });
}

/**
 * Creates a complete {@link FirestoreQueryDriver} for Google Cloud Firestore (Admin SDK).
 *
 * Supports query execution (getDocs), document counting (countDocs), and real-time
 * streaming (streamDocs) via `onSnapshot`. Transaction-aware reads are supported
 * through the optional transaction parameter in `getDocs`.
 *
 * @returns A complete {@link FirestoreQueryDriver} for the Google Cloud Admin SDK.
 *
 * @example
 * ```typescript
 * const queryDriver = googleCloudFirestoreQueryDriver();
 * ```
 */
export function googleCloudFirestoreQueryDriver(): FirestoreQueryDriver {
  return {
    ...firestoreClientQueryConstraintFunctionsDriver(),
    countDocs<T>(query: Query<T>): Promise<number> {
      return (query as FirestoreServerQueryBuilder)
        .count()
        .get()
        .then((x) => x.data().count);
    },
    getDocs<T>(query: Query<T>, transaction?: Transaction): Promise<QuerySnapshot<T>> {
      let result: Promise<QuerySnapshot<T>>;

      if (transaction) {
        result = (transaction as GoogleCloudTransaction).get(query as GoogleCloudQuery<T>);
      } else {
        result = (query as FirestoreServerQueryBuilder<T>).get();
      }

      return result;
    },
    streamDocs<T>(query: Query<T>) {
      return streamFromOnSnapshot<QuerySnapshot<T>>(({ next, error }) => (query as FirestoreServerQueryBuilder<T>).onSnapshot(next, error));
    }
  };
}
