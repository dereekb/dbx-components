/**
 * @module Firestore Query
 *
 * This module provides core functionality for creating and executing Firestore queries,
 * with a fluent interface for extending queries with additional constraints.
 */
import { type Observable } from 'rxjs';
import { type ArrayOrValue, flattenArrayOrValueArray, type Maybe } from '@dereekb/util';
import { type QueryLikeReferenceRef } from '../reference';
import { type Query, type QueryDocumentSnapshot, type QuerySnapshot, type Transaction } from '../types';
import { addOrReplaceLimitInConstraints, type FirestoreQueryConstraint } from './constraint';
import { type FirestoreQueryDriverRef } from '../driver/query';

/**
 * Context for executing a Firestore query.
 *
 * This interface allows specifying optional parameters when executing a query,
 * such as a transaction to run the query within.
 */
export interface FirestoreExecutableQueryGetDocsContext {
  /**
   * Optional transaction to run the query within.
   *
   * When provided, the query will be executed as part of the transaction,
   * ensuring consistency with other operations in the same transaction.
   */
  readonly transaction?: Transaction;
}

/**
 * Immutable wrapper of a Firestore query with methods to execute and extend it.
 *
 * This interface provides a fluent API for working with Firestore queries,
 * allowing them to be executed in various ways (count, get, stream) and
 * extended with additional constraints through the filter method.
 *
 * @template T - The document data type in the query results
 */
export interface FirestoreExecutableQuery<T> {
  /**
   * The underlying Firestore query object.
   */
  readonly query: Query<T>;

  /**
   * Returns the count of documents that match the query.
   *
   * This method efficiently counts matching documents without retrieving their contents.
   *
   * @returns A promise that resolves with the number of matching documents
   */
  countDocs(): Promise<number>;

  /**
   * Retrieves the first document matching the query, if any exists.
   *
   * This method optimizes the query by adding a limit(1) constraint before execution.
   *
   * @param transaction - Optional transaction to execute the query within
   * @returns A promise that resolves with the first matching document snapshot, or undefined if none exist
   */
  getFirstDoc(transaction?: Transaction): Promise<Maybe<QueryDocumentSnapshot<T>>>;

  /**
   * Executes the query and returns all matching documents.
   *
   * @param transaction - Optional transaction to execute the query within
   * @returns A promise that resolves with a snapshot containing all matching documents
   */
  getDocs(transaction?: Transaction): Promise<QuerySnapshot<T>>;

  /**
   * Creates an Observable that streams query results in real-time.
   *
   * This method establishes a listener that emits a new snapshot whenever
   * any of the matching documents change.
   *
   * @returns An Observable that emits query snapshots when documents change
   */
  streamDocs(): Observable<QuerySnapshot<T>>;

  /**
   * Creates a new query by adding more constraints to this query.
   *
   * This method creates a new FirestoreExecutableQuery with the additional constraints
   * applied, preserving the immutability of the original query.
   *
   * @param queryConstraints - Additional constraints to apply to the query
   * @returns A new FirestoreExecutableQuery with the combined constraints
   *
   * @example
   * const baseQuery = queryFactory.query();
   * const filteredQuery = baseQuery.filter(
   *   where('status', '==', 'active'),
   *   orderBy('createdAt', 'desc')
   * );
   */
  filter(...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]): FirestoreExecutableQuery<T>;
}

/**
 * Function that creates a FirestoreExecutableQuery with the specified constraints.
 *
 * This type represents a factory function that creates query instances with a consistent
 * base query (typically a collection or collection group query) and applies the provided
 * constraints.
 *
 * @template T - The document data type in the query results
 */
export type FirestoreQueryFactoryFunction<T> = (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => FirestoreExecutableQuery<T>;

/**
 * Factory for creating Firestore queries with consistent base configuration.
 *
 * This interface provides a method for creating executable queries against a specific
 * collection or query reference, with various constraints applied.
 *
 * @template T - The document data type in the query results
 */
export interface FirestoreQueryFactory<T> {
  /**
   * Creates a new FirestoreExecutableQuery with the specified constraints.
   *
   * This function creates a query against the factory's base query reference
   * (typically a collection or collection group) with the provided constraints applied.
   */
  readonly query: FirestoreQueryFactoryFunction<T>;
}

/**
 * Configuration for creating a FirestoreQueryFactory.
 *
 * This interface combines the necessary components for creating a query factory:
 * - A query-like reference (collection, collection group, etc.)
 * - A query driver to handle the Firestore operations
 *
 * @template T - The document data type in the query results
 */
export interface FirestoreQueryConfig<T> extends FirestoreQueryDriverRef, QueryLikeReferenceRef<T> {}

/**
 * Creates a factory for building and executing Firestore queries against a specific collection.
 *
 * This function creates a query factory that allows building queries with various constraints
 * and executing them in different ways (getting documents, counting, streaming). The factory
 * maintains the base query reference (typically a collection or collection group) and provides
 * a fluent API for working with it.
 *
 * @template T - The document data type in the query results
 * @param config - Configuration for the query factory, including the base query reference and driver
 * @returns A factory for creating and executing queries against the specified collection
 *
 * @example
 * // Create a query factory for the 'users' collection
 * const usersQuery = firestoreQueryFactory({
 *   queryLike: collection(firestore, 'users'),
 *   firestoreQueryDriver: driver
 * });
 *
 * // Use the factory to create and execute queries
 * const activeUsers = await usersQuery.query(
 *   where('status', '==', 'active'),
 *   orderBy('lastLogin', 'desc'),
 *   limit(10)
 * ).getDocs();
 *
 * // Queries can be extended with additional constraints
 * const adminUsers = activeUsers.filter(
 *   where('role', '==', 'admin')
 * ).getDocs();
 */
export function firestoreQueryFactory<T>(config: FirestoreQueryConfig<T>): FirestoreQueryFactory<T> {
  const { queryLike, firestoreQueryDriver: driver } = config;
  const { getDocs, streamDocs, query: makeQuery, countDocs } = driver;

  const extendQuery = (inputQuery: Query<T>, queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => {
    const allConstraints = flattenArrayOrValueArray(queryConstraints);
    const query = makeQuery(inputQuery, ...allConstraints);

    const result: FirestoreExecutableQuery<T> = {
      query,
      countDocs: async () => countDocs(query),
      getFirstDoc: async (transaction?: Transaction) => {
        const constraintsForOneDoc = addOrReplaceLimitInConstraints(1)(allConstraints);
        const query = makeQuery(inputQuery, ...constraintsForOneDoc);
        const result = await getDocs(query, transaction);
        return result.docs[0];
      },
      getDocs: (transaction?: Transaction) => getDocs(query, transaction),
      streamDocs: () => streamDocs(query),
      filter: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => extendQuery(query, queryConstraints)
    };

    return result;
  };

  return {
    query: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => extendQuery(queryLike, queryConstraints)
  };
}
