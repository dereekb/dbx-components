import { type FirestoreCollectionName } from './../collection/collection';
import { type DocumentData, type CollectionReference, type CollectionGroup, type DocumentReference, type Firestore } from '../types';
import { type DefaultFirestoreDocumentContextFactory } from '../accessor/context.default';
import { type WriteBatchFirestoreDocumentContextFactory } from '../accessor/context.batch';
import { type TransactionFirestoreDocumentContextFactory } from '../accessor/context.transaction';
import { type FirestoreWriteBatchFactoryDriver } from './batch';
import { type FirestoreTransactionFactoryDriver } from './transaction';

/**
 * Creates a {@link CollectionGroup} reference spanning all collections with the given ID.
 */
export type FirestoreAccessorDriverCollectionGroupFunction = <T = DocumentData>(firestore: Firestore, collectionId: string) => CollectionGroup<T>;

/**
 * Creates a {@link CollectionReference} at the specified path.
 */
export type FirestoreAccessorDriverCollectionRefFunction = <T = DocumentData>(firestore: Firestore, path: string, ...pathSegments: string[]) => CollectionReference<T>;

/**
 * Creates a {@link CollectionReference} for a subcollection under the given document.
 */
export type FirestoreAccessorDriverSubcollectionRefFunction = <T = DocumentData>(document: DocumentReference, path: string, ...pathSegments: string[]) => CollectionReference<T>;

/**
 * Creates a {@link DocumentReference} within a collection, optionally at a specific path.
 * When no path is provided, a new auto-generated document ID is used.
 */
export type FirestoreAccessorDriverDocumentRefFunction = <T = DocumentData>(collection: CollectionReference<T>, path?: string, ...pathSegments: string[]) => DocumentReference<T>;

/**
 * Creates a {@link DocumentReference} from a full slash-separated Firestore path (e.g., `'users/abc123'`).
 */
export type FirestoreAccessorDriverFullPathDocumentRefFunction = <T = DocumentData>(firestore: Firestore, fullPath: string) => DocumentReference<T>;

/**
 * Transforms collection paths, typically by appending a random suffix, to isolate concurrent
 * test runs from each other. Only used in testing environments.
 */
export type FirestoreAccessorPathFuzzerFunction = (path: FirestoreCollectionName) => FirestoreCollectionName;

/**
 * Driver interface for document and collection CRUD operations.
 *
 * Provides factory functions for creating Firestore references (documents, collections,
 * subcollections, collection groups) as well as context factories for standard, batch,
 * and transaction execution modes. Platform implementations (Web SDK, Admin SDK, test mocks)
 * each provide their own implementation of this interface.
 *
 * @see {@link FirestoreQueryDriver} for the complementary query execution driver
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
