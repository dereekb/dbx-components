import { type Observable } from 'rxjs';
import { type ArrayOrValue, type Maybe } from '@dereekb/util';
import { type DocumentSnapshot, getDocs, limit, query, type QueryConstraint, startAt, type Query as FirebaseFirestoreQuery, where, startAfter, orderBy, limitToLast, endBefore, endAt, onSnapshot, documentId, getCountFromServer } from 'firebase/firestore';
import {
  FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE,
  type FullFirestoreQueryConstraintHandlersMapping,
  FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE
} from './../../common/firestore/query/constraint';
import { makeFirestoreQueryConstraintFunctionsDriver } from '../../common/firestore/driver/query.handler';
import { type FirestoreQueryConstraintFunctionsDriver, type FirestoreQueryDriver } from '../../common/firestore/driver/query';
import { type Query, type QuerySnapshot, type SnapshotListenOptions, type Transaction } from '../../common/firestore/types';
import { streamFromOnSnapshot } from '../../common/firestore/query/query.util';

/**
 * Accumulates Firestore query constraints alongside the base query reference.
 *
 * Used internally by the client query driver to build up constraints before
 * combining them into a final query via the `firebase/firestore` `query()` function.
 */
export interface FirebaseFirestoreQueryBuilder {
  readonly query: Query;
  readonly constraints: QueryConstraint[];
}

/**
 * Appends one or more `QueryConstraint` values to the builder, returning a new builder instance.
 *
 * @param builder - current query builder state
 * @param constraint - constraint(s) to append
 */
export function addConstraintToBuilder(builder: FirebaseFirestoreQueryBuilder, constraint: ArrayOrValue<QueryConstraint>): FirebaseFirestoreQueryBuilder {
  return {
    query: builder.query,
    constraints: builder.constraints.concat(constraint)
  };
}

/**
 * Maps each abstract {@link FirestoreQueryConstraintType} to its client-side `firebase/firestore`
 * implementation. The `FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE` is `undefined` because Firestore
 * client SDK does not support offset-based pagination (server-only feature).
 */
export const FIRESTORE_CLIENT_QUERY_CONSTRAINT_HANDLER_MAPPING: FullFirestoreQueryConstraintHandlersMapping<FirebaseFirestoreQueryBuilder> = {
  [FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, limit(data.limit)),
  [FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, limitToLast(data.limit)),
  [FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, orderBy(data.fieldPath, data.directionStr)),
  [FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, orderBy(documentId(), data.directionStr)),
  [FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, where(data.fieldPath, data.opStr, data.value)),
  [FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, where(documentId(), data.opStr, data.value)),
  [FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE]: undefined,
  [FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, startAt(data.snapshot as DocumentSnapshot)),
  [FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, startAt(...data.fieldValues)),
  [FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, startAfter(data.snapshot as DocumentSnapshot)),
  [FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, endAt(data.snapshot as DocumentSnapshot)),
  [FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, endAt(...data.fieldValues)),
  [FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, endBefore(data.snapshot as DocumentSnapshot))
};

/**
 * Creates a {@link FirestoreQueryConstraintFunctionsDriver} for the client `firebase/firestore` SDK.
 *
 * Converts abstract query constraints into `firebase/firestore` `QueryConstraint` objects
 * and composes them into an executable `Query`.
 */
export function firebaseFirestoreQueryConstraintFunctionsDriver(): FirestoreQueryConstraintFunctionsDriver {
  return makeFirestoreQueryConstraintFunctionsDriver({
    mapping: FIRESTORE_CLIENT_QUERY_CONSTRAINT_HANDLER_MAPPING,
    init: <T>(query: Query<T>) => ({ query, constraints: [] }),
    build: <T>({ query: initialQuery, constraints }: FirebaseFirestoreQueryBuilder) => query(initialQuery as FirebaseFirestoreQuery<T>, ...constraints),
    documentIdFieldPath: () => documentId()
  });
}

/**
 * Creates the client-side {@link FirestoreQueryDriver} that executes queries, counts, and streams
 * using the `firebase/firestore` SDK.
 *
 * Note: Transactions are not supported for queries on the client; passing a `transaction` to `getDocs`
 * will throw an error.
 *
 * @example
 * ```ts
 * const queryDriver = firebaseFirestoreQueryDriver();
 * // Used internally by firebaseFirestoreClientDrivers()
 * ```
 */
export function firebaseFirestoreQueryDriver(): FirestoreQueryDriver {
  return {
    ...firebaseFirestoreQueryConstraintFunctionsDriver(),
    countDocs<T>(query: Query<T>): Promise<number> {
      return getCountFromServer(query as FirebaseFirestoreQuery<T>).then((x) => x.data().count);
    },
    getDocs<T>(query: Query<T>, transaction?: Transaction): Promise<QuerySnapshot<T>> {
      if (transaction) {
        // TODO: Decide if by design we should log an error, or throw an exception like this.
        throw new Error('The firebaseFirestoreQueryDriver does not support transactions with queries.');
      }

      return getDocs(query as FirebaseFirestoreQuery<T>);
    },
    streamDocs<T>(query: Query<T>, options?: Maybe<SnapshotListenOptions>): Observable<QuerySnapshot<T>> {
      return streamFromOnSnapshot((obs) => (options ? onSnapshot(query as FirebaseFirestoreQuery<T>, options, obs) : onSnapshot(query as FirebaseFirestoreQuery<T>, obs)));
    }
  };
}
