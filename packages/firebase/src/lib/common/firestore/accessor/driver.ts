import { DocumentData, CollectionReference, DocumentReference, Firestore } from '../types';
import { DefaultFirestoreDocumentContextFactory } from './context.default';
import { WriteBatchFirestoreDocumentContextFactory } from './context.batch';
import { TransactionFirestoreDocumentContextFactory } from './context.transaction';
import { TransactionFactory, WriteBatchFactory } from '../factory';

export type FirestoreAccessorDriverCollectionRefFunction = <T = DocumentData>(firestore: Firestore, collectionPath: string) => CollectionReference<T>;
export type FirestoreAccessorDriverDocumentRefFunction = <T = DocumentData>(collection: CollectionReference<T>, path?: string) => DocumentReference<T>;

/**
 * A driver to use for query functionality.
 */
export interface FirestoreAccessorDriver extends TransactionFactory, WriteBatchFactory {
  readonly collection: FirestoreAccessorDriverCollectionRefFunction;
  readonly doc: FirestoreAccessorDriverDocumentRefFunction;
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
