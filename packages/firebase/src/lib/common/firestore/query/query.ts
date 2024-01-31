import { type Observable } from 'rxjs';
import { type ArrayOrValue, flattenArrayOrValueArray, type Maybe } from '@dereekb/util';
import { type QueryLikeReferenceRef } from '../reference';
import { type Query, type QueryDocumentSnapshot, type QuerySnapshot, type Transaction } from '../types';
import { addOrReplaceLimitInConstraints, type FirestoreQueryConstraint } from './constraint';
import { type FirestoreQueryDriverRef } from '../driver/query';

export interface FirestoreExecutableQueryGetDocsContext {
  readonly transaction?: Transaction;
}

/**
 * Immutable wrapper of a query and a way to retrieve the docs.
 */
export interface FirestoreExecutableQuery<T> {
  readonly query: Query<T>;
  /**
   * Limits the results to a single document, then returns that first/single document if it exists.
   */
  getFirstDoc(transaction?: Transaction): Promise<Maybe<QueryDocumentSnapshot<T>>>;
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

export type FirestoreQueryFactoryFunction<T> = (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => FirestoreExecutableQuery<T>;

export interface FirestoreQueryFactory<T> {
  /**
   * Creates a new FirestoreExecutableQuery from the input constraints.
   */
  readonly query: FirestoreQueryFactoryFunction<T>;
}

export interface FirestoreQueryConfig<T> extends FirestoreQueryDriverRef, QueryLikeReferenceRef<T> {}

/**
 * Creates a FirestoreCollectionQuery.
 *
 * @param config
 * @returns
 */
export function firestoreQueryFactory<T>(config: FirestoreQueryConfig<T>): FirestoreQueryFactory<T> {
  const { queryLike, firestoreQueryDriver: driver } = config;
  const { getDocs, streamDocs, query: makeQuery } = driver;

  const extendQuery = (inputQuery: Query<T>, queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => {
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
      filter: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => extendQuery(query, queryConstraints)
    };
  };

  return {
    query: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => extendQuery(queryLike, queryConstraints)
  };
}
