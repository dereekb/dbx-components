import { type FirestoreDocument, firestoreDocumentAccessorContextExtension, type LimitedFirestoreDocumentAccessorFactoryConfig, limitedFirestoreDocumentAccessorFactory, type LimitedFirestoreDocumentAccessorFactoryFunction } from '../accessor/document';
import { type FirestoreItemPageIterationBaseConfig, firestoreItemPageIterationFactory, type FirestoreItemPageIterationFactoryFunction } from '../query/iterator';
import { type FirestoreContextReference } from '../reference';
import { firestoreQueryFactory, type FirestoreQueryFactory } from '../query/query';
import { type FirestoreDrivers } from '../driver/driver';
import { firestoreCollectionQueryFactory } from './collection.query';
import { type FirestoreCollectionLike } from './collection';

/**
 * Configuration for creating a Firestore collection group accessor.
 *
 * Collection groups allow querying across all collections with the same ID in the database,
 * regardless of their location in the document hierarchy. This configuration combines
 * several interfaces to provide complete functionality for working with collection groups,
 * including document access, query execution, and pagination.
 *
 * @template T - The data type of the documents in the collection group
 * @template D - The FirestoreDocument type that wraps the data, defaults to FirestoreDocument<T>
 */
export interface FirestoreCollectionGroupConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreContextReference, FirestoreDrivers, FirestoreItemPageIterationBaseConfig<T>, LimitedFirestoreDocumentAccessorFactoryConfig<T, D> {}

/**
 * Interface for working with documents across a Firestore collection group.
 *
 * A collection group provides access to all collections with the same ID across the database,
 * regardless of their location in the document hierarchy. This interface extends
 * FirestoreCollectionLike to provide query capabilities and document access functions
 * while maintaining type safety.
 *
 * Unlike regular collections, collection groups are primarily used for querying rather than
 * document creation or direct access, as the paths to individual documents may not be known.
 *
 * @template T - The data type of the documents in the collection group
 * @template D - The FirestoreDocument type that wraps the data, defaults to FirestoreDocument<T>
 */
export interface FirestoreCollectionGroup<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreCollectionLike<T, D> {
  /**
   * The configuration used to create this collection group.
   */
  readonly config: FirestoreCollectionGroupConfig<T, D>;
}

/**
 * Creates a new FirestoreCollectionGroup instance from the provided configuration.
 *
 * This factory function sets up all the necessary components for working with a collection group,
 * including query factories, document accessors, and iteration utilities. It ensures type safety
 * throughout the querying and document conversion process.
 *
 * Collection groups in Firestore allow querying across all collections with the same ID,
 * which is particularly useful for modeling relationships that can exist at different points
 * in the document hierarchy.
 *
 * @template T - The data type of the documents in the collection group
 * @template D - The FirestoreDocument type that wraps the data
 * @param config - Configuration for the collection group
 * @returns A fully configured FirestoreCollectionGroup instance
 */
export function makeFirestoreCollectionGroup<T, D extends FirestoreDocument<T>>(config: FirestoreCollectionGroupConfig<T, D>): FirestoreCollectionGroup<T, D> {
  const { modelIdentity, queryLike, firestoreContext, firestoreAccessorDriver } = config;

  // Create the iteration factory for pagination support
  const firestoreIteration: FirestoreItemPageIterationFactoryFunction<T> = firestoreItemPageIterationFactory(config);

  // Create the document accessor for loading documents
  const documentAccessor: LimitedFirestoreDocumentAccessorFactoryFunction<T, D> = limitedFirestoreDocumentAccessorFactory(config);

  // Create the query factory for building Firestore queries
  const queryFactory: FirestoreQueryFactory<T> = firestoreQueryFactory(config);

  // Create the document accessor extension with context
  const documentAccessorExtension = firestoreDocumentAccessorContextExtension({ documentAccessor, firestoreAccessorDriver });

  // Create the document-aware query factory
  const { queryDocument } = firestoreCollectionQueryFactory(queryFactory, documentAccessorExtension);
  const { query } = queryFactory;

  // Return the fully constructed collection group
  return {
    config,
    queryLike,
    modelIdentity,
    firestoreContext,
    ...documentAccessorExtension,
    firestoreIteration,
    query,
    queryDocument
  };
}
