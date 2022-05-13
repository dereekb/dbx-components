import { DocumentData, CollectionReference, DocumentReference, Firestore } from '../types';
import { DefaultFirestoreDocumentContextFactory } from '../accessor/context.default';
import { WriteBatchFirestoreDocumentContextFactory } from '../accessor/context.batch';
import { TransactionFirestoreDocumentContextFactory } from '../accessor/context.transaction';
import { FirestoreWriteBatchFactoryDriver } from './batch';
import { FirestoreTransactionFactoryDriver } from './transaction';

export type FirestoreAccessorDriverCollectionRefFunction = <T = DocumentData>(firestore: Firestore, path: string, ...pathSegments: string[]) => CollectionReference<T>;
export type FirestoreAccessorDriverSubcollectionRefFunction = <T = DocumentData>(document: DocumentReference, path: string, ...pathSegments: string[]) => CollectionReference<T>;
export type FirestoreAccessorDriverDocumentRefFunction = <T = DocumentData>(collection: CollectionReference<T>, path?: string, ...pathSegments: string[]) => DocumentReference<T>;

/**
 * A driver to use for query functionality.
 */
export interface FirestoreAccessorDriver extends FirestoreTransactionFactoryDriver, FirestoreWriteBatchFactoryDriver {
  readonly doc: FirestoreAccessorDriverDocumentRefFunction;
  readonly collection: FirestoreAccessorDriverCollectionRefFunction;
  readonly subcollection: FirestoreAccessorDriverSubcollectionRefFunction;
  readonly defaultContextFactory: DefaultFirestoreDocumentContextFactory;
  readonly writeBatchContextFactory: WriteBatchFirestoreDocumentContextFactory;
  readonly transactionContextFactory: TransactionFirestoreDocumentContextFactory;
}

/**
 * Ref to a FirestoreAccessorDriver.
 */
export interface FirestoreAccessorDriverRef {
  firestoreAccessorDriver: FirestoreAccessorDriver;
}
