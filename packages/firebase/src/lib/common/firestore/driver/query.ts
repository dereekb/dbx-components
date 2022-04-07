import { Transaction } from './../types';
import { Observable } from 'rxjs';
import { Query, QuerySnapshot } from "../types";
import { FirestoreQueryConstraint } from "../query/constraint";

export type FirestoreQueryDriverQueryFunction = <T>(query: Query<T>, ...queryConstraints: FirestoreQueryConstraint[]) => Query<T>;

export interface FirestoreQueryConstraintFunctionsDriver {
  readonly availableConstraintTypes: Set<string>;
  query: FirestoreQueryDriverQueryFunction;
}

/**
 * A driver to use for query functionality.
 */
export interface FirestoreQueryDriver extends FirestoreQueryConstraintFunctionsDriver {
  /**
   * Retrieves a QuerySnapshot based on the input Query. A transaction may optionally be provided.
   * 
   * Drivers that do not support the use of the transaction will throw an exception.
   * 
   * @param query 
   * @param transaction
   */
  getDocs<T>(query: Query<T>, transaction?: Transaction): Promise<QuerySnapshot<T>>;
  streamDocs<T>(query: Query<T>): Observable<QuerySnapshot<T>>;
}

/**
 * Ref to a FirestoreQueryDriver.
 */
export interface FirestoreQueryDriverRef {
  readonly firestoreQueryDriver: FirestoreQueryDriver;
}
