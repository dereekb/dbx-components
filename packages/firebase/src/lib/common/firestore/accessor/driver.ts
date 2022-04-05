import { DocumentData, CollectionReference, DocumentReference, Firestore } from '../types';
import { DefaultFirestoreDocumentContextFactory } from './context.default';
import { WriteBatchFirestoreDocumentContextFactory } from './context.batch';
import { TransactionFirestoreDocumentContextFactory } from './context.transaction';
import { FirestoreTransactionFactory, FirestoreWriteBatchFactory } from '../factory';

export type FirestoreAccessorDriverCollectionRefFunction = <T = DocumentData>(firestore: Firestore, path: string, ...pathSegments: string[]) => CollectionReference<T>;
export type FirestoreAccessorDriverSubcollectionRefFunction = <T = DocumentData>(document: DocumentReference, path: string, ...pathSegments: string[]) => CollectionReference<T>;
export type FirestoreAccessorDriverDocumentRefFunction = <T = DocumentData>(collection: CollectionReference<T>, path?: string, ...pathSegments: string[]) => DocumentReference<T>;

/**
 * A driver to use for query functionality.
 */
export interface FirestoreAccessorDriver extends FirestoreTransactionFactory, FirestoreWriteBatchFactory {
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
