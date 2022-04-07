import { Observable } from 'rxjs';
import { ArrayOrValue, flattenArrayOrValueArray } from "@dereekb/util";
import { CollectionReferenceRef } from "../reference";
import { Query, QueryDocumentSnapshot, QuerySnapshot, Transaction } from "../types";
import { addOrReplaceLimitInConstraints, FirestoreQueryConstraint } from "./constraint";
import { FirestoreQueryDriverRef } from '../driver/query';

export interface FirestoreExecutableQueryGetDocsContext {
  readonly transaction?: Transaction;
}

/**
 * Immutable wrapper of a query and a way to retrieve the docs.
 */
export interface FirestoreExecutableQuery<T> {
  readonly query: Query<T>;
  /**
   * Returns the first/single document.
   */
  getFirstDoc(transaction?: Transaction): Promise<QueryDocumentSnapshot<T>>;
  /**
   * Returns the results in a Promise.
   */
  getDocs(transaction?: Transaction): Promise<QuerySnapshot<T>>;
  /**
   * Streams the results as an Observable.
   */
  streamDocs(): Observable<QuerySnapshot<T>>;
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
  const { getDocs, streamDocs, query: makeQuery } = driver;

  const filterQuery = (inputQuery: Query<T>, queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => {
    const allConstraints = flattenArrayOrValueArray(queryConstraints);
    const query = makeQuery(inputQuery, ...allConstraints);

    return {
      query,
      getFirstDoc: async (transaction?: Transaction) => {
        const contraintsForOneDoc = addOrReplaceLimitInConstraints(1)(allConstraints);
        const query = makeQuery(inputQuery, ...contraintsForOneDoc);
        const result = await getDocs(query, transaction);
        return result.docs[0];
      },
      getDocs: (transaction?: Transaction) => getDocs(query, transaction),
      streamDocs: () => streamDocs(query),
      filter: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => filterQuery(query, queryConstraints)
    };
  };

  return {
    query: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => filterQuery(collection, queryConstraints)
  };
}
