import { type FirestoreDocument, firestoreDocumentAccessorContextExtension, type LimitedFirestoreDocumentAccessorFactoryConfig, limitedFirestoreDocumentAccessorFactory, type LimitedFirestoreDocumentAccessorFactoryFunction } from '../accessor/document';
import { type FirestoreItemPageIterationBaseConfig, firestoreItemPageIterationFactory, type FirestoreItemPageIterationFactoryFunction } from '../query/iterator';
import { type FirestoreContextReference } from '../reference';
import { firestoreQueryFactory, type FirestoreQueryFactory } from '../query/query';
import { type FirestoreDrivers } from '../driver/driver';
import { firestoreCollectionQueryFactory } from './collection.query';
import { type FirestoreCollectionLike } from './collection';

/**
 * FirestoreCollection configuration
 */
export interface FirestoreCollectionGroupConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreContextReference, FirestoreDrivers, FirestoreItemPageIterationBaseConfig<T>, LimitedFirestoreDocumentAccessorFactoryConfig<T, D> {}

/**
 * Instance that provides several accessors for accessing documents of a collection.
 */
export interface FirestoreCollectionGroup<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreCollectionLike<T, D> {
  readonly config: FirestoreCollectionGroupConfig<T, D>;
}

/**
 * Creates a new FirestoreCollection from the input config.
 */
export function makeFirestoreCollectionGroup<T, D extends FirestoreDocument<T>>(config: FirestoreCollectionGroupConfig<T, D>): FirestoreCollectionGroup<T, D> {
  const { modelIdentity, queryLike, firestoreContext, firestoreAccessorDriver } = config;
  const firestoreIteration: FirestoreItemPageIterationFactoryFunction<T> = firestoreItemPageIterationFactory(config);
  const documentAccessor: LimitedFirestoreDocumentAccessorFactoryFunction<T, D> = limitedFirestoreDocumentAccessorFactory(config);
  const queryFactory: FirestoreQueryFactory<T> = firestoreQueryFactory(config);

  const documentAccessorExtension = firestoreDocumentAccessorContextExtension({ documentAccessor, firestoreAccessorDriver });
  const { queryDocument } = firestoreCollectionQueryFactory(queryFactory, documentAccessorExtension);
  const { query } = queryFactory;

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

// CollectionGroup does not have a CollectionReference, and this MIGHT be a problem, although I don't believe the CollectionReferenceRef types really expose the collection that much anywayss,
// and instead just use the Query more. Will need to refactor a bit to get closer. Also, FirestoreCollectionGroup will not have a DocumentAccessor, probably, as they are only for querying...

// so the option is either to refactor many types to work just off of Query instead of the CollectionReferenceRef, which might be fine, or the other is to make CollectionGroup a new specific type.
// It might end up being a mixture of the two as well. For instance, in dbx-firebase it may require using any found items to redirect them to their final area...

// alternatively, we also avoid considering the use of CollectionGroups, as their usage is strange anyways.
