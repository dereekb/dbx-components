import { WriteBatch, Transaction } from "../types";
import { FirestoreDocument, FirestoreDocumentAccessor, FirestoreDocumentAccessorFactory, FirestoreDocumentAccessorFactoryFunction, FirestoreDocumentAccessorFactoryConfig, firestoreDocumentAccessorFactory, FirestoreDocumentAccessorForTransactionFactory, FirestoreDocumentAccessorForWriteBatchFactory } from "../accessor/document";
import { FirestoreItemPageIterationBaseConfig, FirestoreItemPageIterationFactory, firestoreItemPageIterationFactory, FirestoreItemPageIterationFactoryFunction } from "../query/iterator";
import { CollectionReferenceRef, FirestoreContextReference } from "../reference";
import { firestoreCollectionQueryFactory, FirestoreCollectionQueryFactory } from '../query/query';
import { FirestoreDrivers } from '../driver/driver';

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
  FirestoreContextReference, CollectionReferenceRef<T>, FirestoreItemPageIterationFactory<T>, FirestoreDocumentAccessorFactory<T, D>, FirestoreCollectionQueryFactory<T>,
  FirestoreDocumentAccessorForTransactionFactory<T, D>, FirestoreDocumentAccessorForWriteBatchFactory<T, D> {
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
  const { query }: FirestoreCollectionQueryFactory<T> = firestoreCollectionQueryFactory(config);

  return {
    config,
    collection,
    firestoreContext,
    firestoreIteration,
    documentAccessor,
    documentAccessorForTransaction(transaction: Transaction): FirestoreDocumentAccessor<T, D> {
      return documentAccessor(firestoreAccessorDriver.transactionContextFactory(transaction));
    },
    documentAccessorForWriteBatch(writeBatch: WriteBatch): FirestoreDocumentAccessor<T, D> {
      return documentAccessor(firestoreAccessorDriver.writeBatchContextFactory(writeBatch));
    },
    query
  };
}
