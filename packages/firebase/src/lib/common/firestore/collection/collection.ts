import { CollectionReferenceRef, FirestoreContextReference, QueryLikeReferenceRef } from '../reference';
import {
  FirestoreDocument,
  FirestoreDocumentAccessorFactory,
  FirestoreDocumentAccessorFactoryFunction,
  FirestoreDocumentAccessorFactoryConfig,
  firestoreDocumentAccessorFactory,
  FirestoreDocumentAccessorForTransactionFactory,
  FirestoreDocumentAccessorForWriteBatchFactory,
  firestoreDocumentAccessorContextExtension,
  LimitedFirestoreDocumentAccessorFactory,
  LimitedFirestoreDocumentAccessorForTransactionFactory,
  LimitedFirestoreDocumentAccessorForWriteBatchFactory,
  LimitedFirestoreDocumentAccessor,
  FirestoreDocumentAccessor
} from '../accessor/document';
import { FirestoreItemPageIterationBaseConfig, FirestoreItemPageIterationFactory, firestoreItemPageIterationFactory, FirestoreItemPageIterationFactoryFunction } from '../query/iterator';
import { firestoreQueryFactory, FirestoreQueryFactory } from '../query/query';
import { FirestoreDrivers } from '../driver/driver';
import { FirestoreCollectionQueryFactory, firestoreCollectionQueryFactory } from './collection.query';
import { Building, ModelTypeString } from '@dereekb/util';

/**
 * An all-lowercase collection name that also acts as a model type.
 *
 * This is the part of the path that says what the collection is.
 *
 * Each collection name in the app should be unique, as usage of CollectionGroups would cause collections with the same name to be returned.
 */
export type FirestoreCollectionName = ModelTypeString;

// MARK: FirestoreCollectionLike
/**
 * Instance that provides several accessors for accessing documents of a collection.
 */
export interface FirestoreCollectionLike<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>>
  extends FirestoreContextReference,
    QueryLikeReferenceRef<T>,
    FirestoreItemPageIterationFactory<T>,
    FirestoreQueryFactory<T>,
    LimitedFirestoreDocumentAccessorFactory<T, D, A>,
    LimitedFirestoreDocumentAccessorForTransactionFactory<T, D, A>,
    LimitedFirestoreDocumentAccessorForWriteBatchFactory<T, D, A>,
    FirestoreCollectionQueryFactory<T, D> {}

// MARK: FirestoreCollection
/**
 * FirestoreCollection configuration
 */
export interface FirestoreCollectionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreContextReference, FirestoreDrivers, Omit<FirestoreItemPageIterationBaseConfig<T>, 'queryLike'>, Partial<QueryLikeReferenceRef<T>>, FirestoreDocumentAccessorFactoryConfig<T, D> {}

/**
 * Instance that provides several accessors for accessing documents of a collection.
 *
 * Provides a full FirestoreDocumentAccessor instead of limited accessors.
 */
export interface FirestoreCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreCollectionLike<T, D, FirestoreDocumentAccessor<T, D>>, CollectionReferenceRef<T>, FirestoreDocumentAccessorFactory<T, D>, FirestoreDocumentAccessorForTransactionFactory<T, D>, FirestoreDocumentAccessorForWriteBatchFactory<T, D> {
  readonly config: FirestoreCollectionConfig<T, D>;
}

/**
 * Ref to a FirestoreCollection
 */
export interface FirestoreCollectionRef<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly firestoreCollection: FirestoreCollection<T, D>;
}

/**
 * Creates a new FirestoreCollection from the input config.
 */
export function makeFirestoreCollection<T, D extends FirestoreDocument<T>>(inputConfig: FirestoreCollectionConfig<T, D>): FirestoreCollection<T, D> {
  const config = inputConfig as FirestoreCollectionConfig<T, D> & QueryLikeReferenceRef<T>;

  const { collection, firestoreContext, firestoreAccessorDriver } = config;
  (config as unknown as Building<QueryLikeReferenceRef<T>>).queryLike = collection;

  const firestoreIteration: FirestoreItemPageIterationFactoryFunction<T> = firestoreItemPageIterationFactory(config);
  const documentAccessor: FirestoreDocumentAccessorFactoryFunction<T, D> = firestoreDocumentAccessorFactory(config);
  const queryFactory: FirestoreQueryFactory<T> = firestoreQueryFactory(config);

  const documentAccessorExtension = firestoreDocumentAccessorContextExtension({ documentAccessor, firestoreAccessorDriver });
  const { queryDocument } = firestoreCollectionQueryFactory(queryFactory, documentAccessorExtension);
  const { query } = queryFactory;

  return {
    config,
    collection,
    queryLike: collection,
    firestoreContext,
    ...documentAccessorExtension,
    firestoreIteration,
    query,
    queryDocument
  };
}
