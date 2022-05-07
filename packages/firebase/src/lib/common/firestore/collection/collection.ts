import { FirestoreDocument, FirestoreDocumentAccessorFactory, FirestoreDocumentAccessorFactoryFunction, FirestoreDocumentAccessorFactoryConfig, firestoreDocumentAccessorFactory, FirestoreDocumentAccessorForTransactionFactory, FirestoreDocumentAccessorForWriteBatchFactory, firestoreDocumentAccessorContextExtension } from "../accessor/document";
import { FirestoreItemPageIterationBaseConfig, FirestoreItemPageIterationFactory, firestoreItemPageIterationFactory, FirestoreItemPageIterationFactoryFunction } from "../query/iterator";
import { CollectionReferenceRef, FirestoreContextReference } from "../reference";
import { firestoreQueryFactory, FirestoreQueryFactory } from '../query/query';
import { FirestoreDrivers } from '../driver/driver';
import { FirestoreCollectionQueryFactory, firestoreCollectionQueryFactory } from "./collection.query";

/**
 * FirestoreCollection configuration
 */
export interface FirestoreCollectionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>
  extends FirestoreContextReference, FirestoreDrivers, FirestoreItemPageIterationBaseConfig<T>, FirestoreDocumentAccessorFactoryConfig<T, D> {
}

/**
* Instance that provides several accessors for accessing documents of a collection.
*/
export interface FirestoreCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends
  FirestoreContextReference, CollectionReferenceRef<T>, FirestoreItemPageIterationFactory<T>, FirestoreDocumentAccessorFactory<T, D>, FirestoreQueryFactory<T>,
  FirestoreDocumentAccessorForTransactionFactory<T, D>, FirestoreDocumentAccessorForWriteBatchFactory<T, D>, FirestoreCollectionQueryFactory<T, D> {
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
export function makeFirestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreCollectionConfig<T, D>): FirestoreCollection<T, D> {
  const { collection, firestoreContext, firestoreAccessorDriver } = config;
  const firestoreIteration: FirestoreItemPageIterationFactoryFunction<T> = firestoreItemPageIterationFactory(config);
  const documentAccessor: FirestoreDocumentAccessorFactoryFunction<T, D> = firestoreDocumentAccessorFactory(config);
  const queryFactory: FirestoreQueryFactory<T> = firestoreQueryFactory(config);

  const documentAccessorExtension = firestoreDocumentAccessorContextExtension({ documentAccessor, firestoreAccessorDriver });
  const { queryDocument } = firestoreCollectionQueryFactory(queryFactory, documentAccessorExtension);
  const { query } = queryFactory;

  return {
    config,
    collection,
    firestoreContext,
    ...documentAccessorExtension,
    firestoreIteration,
    query,
    queryDocument
  };
}
