import { type FieldPath, type SnapshotListenOptions, type Transaction } from './../types';
import { type Observable } from 'rxjs';
import { type Query, type QuerySnapshot } from '../types';
import { type FirestoreQueryConstraint } from '../query/constraint';
import { type Maybe } from '@dereekb/util';

export type FirestoreQueryDriverQueryFunction = <T>(query: Query<T>, ...queryConstraints: FirestoreQueryConstraint[]) => Query<T>;
export type FirestoreDocumentIdFieldPathAccessor = () => FieldPath;

export interface FirestoreQueryConstraintFunctionsDriver {
  readonly availableConstraintTypes: Set<string>;
  readonly query: FirestoreQueryDriverQueryFunction;
  readonly documentIdFieldPath: FirestoreDocumentIdFieldPathAccessor;
}

/**
 * A driver to use for query functionality.
 */
export interface FirestoreQueryDriver extends FirestoreQueryConstraintFunctionsDriver {
  /**
   * Counts only the number of matching documents for the query.
   *
   * @param query
   *
   * @see https://firebase.google.com/docs/firestore/query-data/aggregation-queries for more info.
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
