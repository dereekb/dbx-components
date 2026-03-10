import { type FieldPath, type SnapshotListenOptions, type Transaction, type Query, type QuerySnapshot } from './../types';
import { type Observable } from 'rxjs';
import { type FirestoreQueryConstraint } from '../query/constraint';
import { type Maybe } from '@dereekb/util';

/**
 * Applies query constraints to a base query and returns the constrained query.
 */
export type FirestoreQueryDriverQueryFunction = <T>(query: Query<T>, ...queryConstraints: FirestoreQueryConstraint[]) => Query<T>;

/**
 * Returns the platform-specific {@link FieldPath} sentinel for the document ID.
 * Used internally by `whereDocumentId()` constraints.
 */
export type FirestoreDocumentIdFieldPathAccessor = () => FieldPath;

/**
 * Low-level driver for building queries from constraint objects.
 *
 * Tracks which constraint types (where, orderBy, limit, etc.) the current platform
 * supports and provides the function to apply them to a query.
 */
export interface FirestoreQueryConstraintFunctionsDriver {
  readonly availableConstraintTypes: Set<string>;
  readonly query: FirestoreQueryDriverQueryFunction;
  readonly documentIdFieldPath: FirestoreDocumentIdFieldPathAccessor;
}

/**
 * Driver interface for executing Firestore queries.
 *
 * Extends {@link FirestoreQueryConstraintFunctionsDriver} with methods for counting,
 * fetching, and streaming query results. Platform implementations (Web SDK, Admin SDK,
 * test mocks) each provide their own implementation.
 *
 * @see {@link FirestoreAccessorDriver} for the complementary document CRUD driver
 */
export interface FirestoreQueryDriver extends FirestoreQueryConstraintFunctionsDriver {
  /**
   * Counts only the number of matching documents for the query.
   *
   * @param query
   * @see https://firebase.google.com/docs/firestore/query-data/aggregation-queries for more info.
   *
   * NOTE: If using with startAt, make sure there is an orderBy filter also added, otherwise you may encounter a seemingly unrelated "cursor has too many values" error.
   */
  countDocs<T>(query: Query<T>): Promise<number>;
  /**
   * Retrieves a QuerySnapshot based on the input Query. A transaction may optionally be provided.
   *
   * Drivers that do not support the use of the transaction will throw an exception.
   *
   * @param query
   * @param transaction
   */
  getDocs<T>(query: Query<T>, transaction?: Transaction): Promise<QuerySnapshot<T>>;
  streamDocs<T>(query: Query<T>, options?: Maybe<SnapshotListenOptions>): Observable<QuerySnapshot<T>>;
}

/**
 * Ref to a FirestoreQueryDriver.
 */
export interface FirestoreQueryDriverRef {
  readonly firestoreQueryDriver: FirestoreQueryDriver;
}
