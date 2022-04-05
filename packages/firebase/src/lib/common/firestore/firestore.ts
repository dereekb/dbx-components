import { FirestoreAccessorDriverRef } from './accessor/driver';
import { FirestoreQueryDriverRef } from './query/driver';
import { WriteBatch, Transaction } from "./types";
import { FirestoreDocument, FirestoreDocumentAccessor, FirestoreDocumentAccessorFactory, FirestoreDocumentAccessorFactoryFunction, FirestoreDocumentAccessorFactoryConfig, firestoreDocumentAccessorFactory, FirestoreDocumentAccessorForTransactionFactory, FirestoreDocumentAccessorForWriteBatchFactory, FirestoreSingleDocumentAccessor, firestoreSingleDocumentAccessor } from "./accessor/document";
import { FirestoreItemPageIterationBaseConfig, FirestoreItemPageIterationFactory, firestoreItemPageIterationFactory, FirestoreItemPageIterationFactoryFunction } from "./query/iterator";
import { CollectionReferenceRef, FirestoreContextReference } from "./reference";
import { firestoreCollectionQueryFactory, FirestoreCollectionQueryFactory } from './query/query';

export type FirestoreDriverIdentifier = string;
export type FirestoreDriverType = 'production' | 'testing';

/**
 * Implements all Firestore related driver reference interfaces.
 */
export interface FirestoreDrivers extends FirestoreQueryDriverRef, FirestoreAccessorDriverRef {
  driverIdentifier?: FirestoreDriverIdentifier;
  driverType: FirestoreDriverType;
}

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

// MARK: Sub-Collection
/**
 * Used for Subcollection types that 
 */
export interface FirestoreCollectionWithParentConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollectionConfig<T, D> {

  /**
   * The parent document.
   */
  readonly parent: PD;
}

/**
 * A FirestoreCollection as a reference to a Subcollection.
 */
export interface FirestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollection<T, D> {
  readonly parent: PD;
}

/**
 * Creates a new FirestoreCollectionWithParent from the input config.
 */
export function makeFirestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreCollectionWithParentConfig<T, PT, D, PD>): FirestoreCollectionWithParent<T, PT, D, PD> {
  const result = makeFirestoreCollection(config) as FirestoreCollection<T, D> & { parent: PD };
  result.parent = config.parent;
  return result;
}

// MARK: Single-Item Subcollection
export interface SingleItemFirestoreCollectionConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollectionWithParentConfig<T, PT, D, PD> {

  /**
   * Identifier of the single item.
   */
  readonly singleItemIdentifier: string;

}


export interface SingleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreSingleDocumentAccessor<T, D> {
  readonly collection: FirestoreCollectionWithParent<T, PT, D, PD>;
}

export function makeSingleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: SingleItemFirestoreCollectionConfig<T, PT, D, PD>): SingleItemFirestoreCollection<T, PT, D, PD> {
  const collection = makeFirestoreCollectionWithParent(config);

  return {
    collection,
    ...firestoreSingleDocumentAccessor({
      accessors: collection,
      singleItemIdentifier: config.singleItemIdentifier
    })
  };
}
