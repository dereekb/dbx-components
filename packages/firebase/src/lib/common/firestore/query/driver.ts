import { DocumentSnapshot, Query, QueryConstraint, QuerySnapshot } from "../types";
import { FirestoreQueryConstraint } from "./constraint";

/**
 * A driver to use for query functionality.
 */
export interface FirestoreQueryDriver {
  readonly availableConstraintTypes: string[];
  query<T>(query: Query<T>, ...queryConstraints: FirestoreQueryConstraint[]): Query<T>;
  getDocs<T>(query: Query<T>): Promise<QuerySnapshot<T>>;
}

/**
 * Ref to a FirestoreQueryDriver.
 */
export interface FirestoreQueryDriverRef {
  firestoreQueryDriver: FirestoreQueryDriver;
}
