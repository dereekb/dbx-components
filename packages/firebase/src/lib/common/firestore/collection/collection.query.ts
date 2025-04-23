import { type LimitedFirestoreDocumentAccessorContextExtension } from './../accessor/document';
import { type ArrayOrValue, type Maybe } from '@dereekb/util';
import { type FirestoreDocument } from '../accessor/document';
import { documentReferencesFromSnapshot, type FirestoreExecutableQuery, type FirestoreQueryFactory } from '../query';
import { type FirestoreQueryConstraint } from '../query/constraint';
import { type Transaction } from '../types';
import { map, type Observable } from 'rxjs';
import { firestoreDocumentLoader, firestoreQueryDocumentSnapshotPairsLoader, type FirestoreDocumentSnapshotDataPairWithData } from '../accessor';

/**
 * An executable Firestore query that returns typed document objects.
 *
 * This interface extends the basic FirestoreExecutableQuery with methods that automatically
 * convert Firestore document snapshots to fully-typed application model objects. It provides
 * a fluent API for querying collections and processing the results as either Promises or
 * Observables.
 *
 * @template T - The data type of the documents
 * @template D - The FirestoreDocument type that wraps the data
 *
 * @example
 * // Create a query for active users created in the last 30 days
 * const recentActiveUsers = usersCollection.queryDocument(
 *   where('status', '==', 'active'),
 *   where('createdAt', '>=', thirtyDaysAgo)
 * );
 *
 * // Get all matching users
 * const users = await recentActiveUsers.getDocs();
 *
 * // Or stream updates in real-time
 * recentActiveUsers.streamDocs().subscribe(users => {
 *   console.log('Active users updated:', users);
 * });
 */
export interface FirestoreCollectionExecutableDocumentQuery<T, D extends FirestoreDocument<T>> {
  /**
   * The underlying base query that this document query wraps.
   * This gives access to the raw Firestore query functionality if needed.
   */
  readonly baseQuery: FirestoreExecutableQuery<T>;

  /**
   * Returns the total number of documents that match this query.
   *
   * This is useful for pagination or checking if results exist without
   * retrieving the full documents.
   *
   * @returns A promise that resolves to the count of matching documents
   */
  countDocs(): Promise<number>;

  /**
   * Limits the results to a single document, then returns that first/single document if it exists.
   *
   * This is a convenience method for queries where you expect a single result or
   * are only interested in the first match.
   *
   * @param transaction - Optional transaction to perform this operation in
   * @returns A promise that resolves to the first matching document or undefined if none exists
   */
  getFirstDoc(transaction?: Transaction): Promise<Maybe<D>>;

  /**
   * Limits the results to a single document, then returns that first/single
   * FirestoreDocumentSnapshotDataPair for the document if it exists.
   *
   * This provides both the document snapshot and converted data object,
   * giving access to metadata like create/update times while still having
   * the typed document data.
   *
   * @param transaction - Optional transaction to perform this operation in
   * @returns A promise that resolves to the first matching document pair or undefined if none exists
   */
  getFirstDocSnapshotDataPair(transaction?: Transaction): Promise<Maybe<FirestoreDocumentSnapshotDataPairWithData<D>>>;

  /**
   * Returns all matching documents as a Promise of document array.
   *
   * This retrieves all documents matching the query constraints and converts
   * them to the appropriate document model type.
   *
   * @param transaction - Optional transaction to perform this operation in
   * @returns A promise that resolves to an array of typed documents
   */
  getDocs(transaction?: Transaction): Promise<D[]>;

  /**
   * Returns all matching documents as a Promise of document snapshot data pairs.
   *
   * This retrieves all documents matching the query constraints and provides both
   * the raw snapshots and converted document models, useful when you need access
   * to metadata like create/update times.
   *
   * @param transaction - Optional transaction to perform this operation in
   * @returns A promise that resolves to an array of document snapshot data pairs
   */
  getDocSnapshotDataPairs(transaction?: Transaction): Promise<FirestoreDocumentSnapshotDataPairWithData<D>[]>;

  /**
   * Streams the query results as an Observable that emits whenever the query results change.
   *
   * This sets up a real-time listener for the query and automatically converts
   * snapshots to typed document models. The Observable emits the complete result set
   * each time any document in the set changes.
   *
   * @returns An Observable that emits arrays of typed documents
   */
  streamDocs(): Observable<D[]>;

  /**
   * Streams the query results as an Observable of document snapshot data pairs.
   *
   * Similar to streamDocs(), but provides both the raw snapshots and converted document
   * models, giving access to metadata while maintaining type safety.
   *
   * @returns An Observable that emits arrays of document snapshot data pairs
   */
  streamDocSnapshotDataPairs(): Observable<FirestoreDocumentSnapshotDataPairWithData<D>[]>;

  /**
   * Extends this query by adding additional filters or constraints.
   *
   * This enables fluent composition of queries by adding constraints incrementally.
   * It returns a new query instance with the combined constraints of the original
   * query plus the new ones.
   *
   * @param queryConstraints - One or more query constraints to apply
   * @returns A new query with the additional constraints applied
   *
   * @example
   * // Start with a basic query
   * let query = usersCollection.queryDocument();
   *
   * // Add filters conditionally
   * if (filterByStatus) {
   *   query = query.filter(where('status', '==', selectedStatus));
   * }
   *
   * // Add more constraints and execute
   * const result = await query
   *   .filter(orderBy('createdAt', 'desc'))
   *   .filter(limit(10))
   *   .getDocs();
   */
  filter(...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]): FirestoreCollectionExecutableDocumentQuery<T, D>;
}

/**
 * Creates a new FirestoreExecutableQuery from the input constraints for a FirestoreDocument.
 *
 * This factory function type creates document-aware queries by applying constraints and
 * returning an executable query that handles document conversion automatically.
 *
 * @template T - The data type of the documents
 * @template D - The FirestoreDocument type that wraps the data
 *
 * @param queryConstraints - Zero or more constraints to apply to the query
 * @returns An executable document query configured with the specified constraints
 *
 * @example
 * // Type definition of the query factory function
 * const queryUsers: FirestoreCollectionQueryFactoryFunction<UserData, UserDocument> =
 *   usersCollection.queryDocument;
 *
 * // Using the factory function to create a query
 * const activeUsersQuery = queryUsers(where('status', '==', 'active'));
 */
export type FirestoreCollectionQueryFactoryFunction<T, D extends FirestoreDocument<T>> = (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => FirestoreCollectionExecutableDocumentQuery<T, D>;

/**
 * Factory for creating document-aware Firestore queries for a collection.
 *
 * This interface provides access to query factory functions that create executable
 * queries that automatically convert Firestore snapshots to typed document models.
 *
 * @template T - The data type of the documents
 * @template D - The FirestoreDocument type that wraps the data
 *
 * @example
 * // A collection with a query factory
 * const usersCollection: FirestoreCollection<UserData, UserDocument> = makeFirestoreCollection({
 *   collectionPath: 'users',
 *   converter: userConverter
 * });
 *
 * // Use the factory to create a query
 * const activeUsersQuery = usersCollection.queryFactory.queryDocument(
 *   where('status', '==', 'active')
 * );
 */
export interface FirestoreCollectionQueryFactory<T, D extends FirestoreDocument<T>> {
  /**
   * Factory function for creating document queries with optional constraints.
   * This is the primary method for creating typed queries against a collection.
   */
  readonly queryDocument: FirestoreCollectionQueryFactoryFunction<T, D>;
}

/**
 * Creates a query factory for Firestore collections that automatically handles document conversion.
 *
 * This factory function bridges the gap between raw Firestore queries and typed document models
 * by wrapping standard query operations with document loading capabilities. It transforms
 * query results from raw Firestore snapshots into fully-typed document model instances.
 *
 * @template T - The data type of the documents
 * @template D - The FirestoreDocument type that wraps the data
 * @param queryFactory - The base query factory for creating raw Firestore queries
 * @param accessorContext - The document accessor context for loading and converting documents
 * @returns A collection query factory for creating document-aware queries
 *
 * @example
 * // Creating a collection query factory
 * const userQueryFactory = firestoreCollectionQueryFactory(
 *   userQueryFactory,  // Base query factory
 *   userAccessorContext  // Document accessor context
 * );
 *
 * // Using the factory to create and execute a query
 * const activeUsers = await userQueryFactory
 *   .queryDocument(where('status', '==', 'active'))
 *   .getDocs();
 */
export function firestoreCollectionQueryFactory<T, D extends FirestoreDocument<T>>(queryFactory: FirestoreQueryFactory<T>, accessorContext: LimitedFirestoreDocumentAccessorContextExtension<T, D>): FirestoreCollectionQueryFactory<T, D> {
  // Create document loaders that convert Firestore snapshots to document models
  const documentLoader = firestoreDocumentLoader(accessorContext);
  const documentSnapshotPairsLoader = firestoreQueryDocumentSnapshotPairsLoader(accessorContext);

  /**
   * Internal utility function that wraps a base Firestore query with document conversion capabilities.
   * This creates the executable document query interface from a raw Firestore query.
   *
   * @param baseQuery - The raw Firestore query to wrap
   * @returns A document-aware executable query
   */
  const wrapQuery: (baseQuery: FirestoreExecutableQuery<T>) => FirestoreCollectionExecutableDocumentQuery<T, D> = (baseQuery: FirestoreExecutableQuery<T>) => {
    return {
      baseQuery,
      countDocs: async () => baseQuery.countDocs(),
      getFirstDoc: async (transaction?: Transaction) => {
        const result = await baseQuery.getFirstDoc(transaction);
        return result ? documentLoader([result.ref])[0] : undefined;
      },
      getFirstDocSnapshotDataPair: async (transaction?: Transaction) => {
        const result = await baseQuery.getFirstDoc(transaction);
        return result ? documentSnapshotPairsLoader([result])[0] : undefined;
      },
      getDocs: (transaction?: Transaction) => baseQuery.getDocs(transaction).then((x) => documentLoader(documentReferencesFromSnapshot(x), transaction)),
      getDocSnapshotDataPairs: (transaction?: Transaction) => baseQuery.getDocs(transaction).then((x) => documentSnapshotPairsLoader(x.docs, transaction)),
      streamDocs: () => baseQuery.streamDocs().pipe(map((x) => documentLoader(documentReferencesFromSnapshot(x)))),
      streamDocSnapshotDataPairs: () => baseQuery.streamDocs().pipe(map((x) => documentSnapshotPairsLoader(x.docs))),
      filter: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => wrapQuery(baseQuery.filter(...queryConstraints))
    };
  };

  // Return the factory interface with the queryDocument function
  return {
    queryDocument: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => wrapQuery(queryFactory.query(...queryConstraints))
  };
}
