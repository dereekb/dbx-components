import { type FirestoreCollectionName } from './../collection/collection';
import { type DocumentData, type CollectionReference, type CollectionGroup, type DocumentReference, type Firestore } from '../types';
import { type DefaultFirestoreDocumentContextFactory } from '../accessor/context.default';
import { type WriteBatchFirestoreDocumentContextFactory } from '../accessor/context.batch';
import { type TransactionFirestoreDocumentContextFactory } from '../accessor/context.transaction';
import { type FirestoreWriteBatchFactoryDriver } from './batch';
import { type FirestoreTransactionFactoryDriver } from './transaction';

export type FirestoreAccessorDriverCollectionGroupFunction = <T = DocumentData>(firestore: Firestore, collectionId: string) => CollectionGroup<T>;
export type FirestoreAccessorDriverCollectionRefFunction = <T = DocumentData>(firestore: Firestore, path: string, ...pathSegments: string[]) => CollectionReference<T>;
export type FirestoreAccessorDriverSubcollectionRefFunction = <T = DocumentData>(document: DocumentReference, path: string, ...pathSegments: string[]) => CollectionReference<T>;
export type FirestoreAccessorDriverDocumentRefFunction = <T = DocumentData>(collection: CollectionReference<T>, path?: string, ...pathSegments: string[]) => DocumentReference<T>;
export type FirestoreAccessorDriverFullPathDocumentRefFunction = <T = DocumentData>(firestore: Firestore, fullPath: string) => DocumentReference<T>;
export type FirestoreAccessorPathFuzzerFunction = (path: FirestoreCollectionName) => FirestoreCollectionName;

/**
 * A driver to use for query functionality.
 */
export interface FirestoreAccessorDriver extends FirestoreTransactionFactoryDriver, FirestoreWriteBatchFactoryDriver {
  readonly doc: FirestoreAccessorDriverDocumentRefFunction;
  readonly docAtPath: FirestoreAccessorDriverFullPathDocumentRefFunction;
  readonly collectionGroup: FirestoreAccessorDriverCollectionGroupFunction;
  readonly collection: FirestoreAccessorDriverCollectionRefFunction;
  readonly subcollection: FirestoreAccessorDriverSubcollectionRefFunction;
  readonly defaultContextFactory: DefaultFirestoreDocumentContextFactory;
  readonly writeBatchContextFactory: WriteBatchFirestoreDocumentContextFactory;
  readonly transactionContextFactory: TransactionFirestoreDocumentContextFactory;
  /**
   * Optional function that when made available communicates that paths are being fuzzed.
   *
   * This is usually only available within testing environments.
   */
  readonly fuzzedPathForPath?: FirestoreAccessorPathFuzzerFunction;
}

/**
 * Ref to a FirestoreAccessorDriver.
 */
export interface FirestoreAccessorDriverRef {
  firestoreAccessorDriver: FirestoreAccessorDriver;
}
