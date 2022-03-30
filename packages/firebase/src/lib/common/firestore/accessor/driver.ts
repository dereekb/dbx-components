import { DocumentData, CollectionReference, DocumentReference, Firestore } from '../types';
import { DefaultFirestoreDocumentContextFactory } from './context.default';
import { WriteBatchFirestoreDocumentContextFactory } from './context.batch';
import { TransactionFirestoreDocumentContextFactory } from './context.transaction';

export type FirestoreAccessorDriverCollectionRefFunction = <T = DocumentData>(firestore: Firestore, collectionPath: string) => CollectionReference<T>;
export type FirestoreAccessorDriverDocumentRefFunction = <T = DocumentData>(collection: CollectionReference<T>, path?: string) => DocumentReference<T>;

/**
 * A driver to use for query functionality.
 */
export interface FirestoreAccessorDriver {
  collection: FirestoreAccessorDriverCollectionRefFunction;
  doc: FirestoreAccessorDriverDocumentRefFunction;
  defaultContextFactory: DefaultFirestoreDocumentContextFactory;
  writeBatchContextFactory: WriteBatchFirestoreDocumentContextFactory;
  transactionContextFactory: TransactionFirestoreDocumentContextFactory;
}

/**
 * Ref to a FirestoreAccessorDriver.
 */
export interface FirestoreAccessorDriverRef {
  firestoreAccessorDriver: FirestoreAccessorDriver;
}
