import { ArrayOrValue, flattenArrayOrValueArray } from "@dereekb/util";
import { CollectionReferenceRef } from "../reference";
import { Query, QuerySnapshot } from "../types";
import { FirestoreQueryConstraint } from "./constraint";
import { FirestoreQueryDriverRef } from "./driver";

/**
 * Immutable wrapper of a query and a way to retrieve the docs.
 */
export interface FirestoreExecutableQuery<T> {
  readonly query: Query<T>;
  getDocs(): Promise<QuerySnapshot<T>>;
  /**
   * Extend this query by adding additional filters.
   * 
   * @param queryConstraints 
   */
  filter(...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]): FirestoreExecutableQuery<T>;
}

export type FirestoreCollectionQueryFactoryFunction<T> = (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => FirestoreExecutableQuery<T>;

export interface FirestoreCollectionQueryFactory<T> {
  /**
   * Creates a new FirestoreExecutableQuery from the input constraints.
   */
  readonly query: FirestoreCollectionQueryFactoryFunction<T>
}

export interface FirestoreCollectionQueryConfig<T> extends FirestoreQueryDriverRef, CollectionReferenceRef<T> { }

/**
 * Creates a FirestoreCollectionQuery.
 * 
 * @param config 
 * @returns 
 */
export function firestoreCollectionQueryFactory<T>(config: FirestoreCollectionQueryConfig<T>): FirestoreCollectionQueryFactory<T> {
  const { collection, firestoreQueryDriver: driver } = config;
  const { getDocs, query: makeQuery } = driver;

  const filterQuery = (inputQuery: Query<T>, queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => {
    const allConstraints = flattenArrayOrValueArray(queryConstraints);
    const query = makeQuery(inputQuery, ...allConstraints);

    return {
      query,
      getDocs: () => getDocs(query),
      filter: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => filterQuery(query, queryConstraints)
    };
  };

  return {
    query: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => filterQuery(collection, queryConstraints)
  };
}
