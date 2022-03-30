import { Query, QuerySnapshot } from "../types";
import { FirestoreQueryConstraint } from "./constraint";

export type FirestoreQueryDriverQueryFunction = <T>(query: Query<T>, ...queryConstraints: FirestoreQueryConstraint[]) => Query<T>;

export interface FirestoreQueryConstraintFunctionsDriver {
  readonly availableConstraintTypes: Set<string>;
  query: FirestoreQueryDriverQueryFunction;
}

/**
 * A driver to use for query functionality.
 */
export interface FirestoreQueryDriver extends FirestoreQueryConstraintFunctionsDriver {
  getDocs<T>(query: Query<T>): Promise<QuerySnapshot<T>>;
}

/**
 * Ref to a FirestoreQueryDriver.
 */
export interface FirestoreQueryDriverRef {
  firestoreQueryDriver: FirestoreQueryDriver;
}
