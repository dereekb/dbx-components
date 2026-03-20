import { type FirestoreAccessorDriver, type CollectionReference, type Firestore, type TransactionFunction, type DocumentReference, type TransactionFirestoreDocumentContextFactory, type WriteBatchFirestoreDocumentContextFactory } from '@dereekb/firebase';
import { batch } from '@dereekb/util';
import { type CollectionGroup, type CollectionReference as GoogleCloudCollectionReference, type DocumentReference as GoogleCloudDocumentReference, type Firestore as GoogleCloudFirestore } from '@google-cloud/firestore';
import { writeBatchDocumentContext } from './driver.accessor.batch';
import { defaultFirestoreDocumentContext } from './driver.accessor.default';
import { transactionDocumentContext } from './driver.accessor.transaction';

interface DocRefForPathInput {
  readonly doc: (path: string) => DocumentReference;
}
interface CollectionRefForPathInput {
  readonly collection: (path: string) => CollectionReference;
}
interface DocRefSource {
  readonly doc: (path: string) => CollectionReference & CollectionRefForPathInput;
}

/**
 * Resolves a Firestore {@link CollectionReference} from a starting point and optional additional path segments.
 *
 * Supports nested subcollection paths by processing segments in pairs (doc ID, collection name).
 *
 * @param start - A Firestore object that can resolve collection paths (e.g., Firestore instance, DocumentReference).
 * @param path - The initial collection path.
 * @param pathSegments - Optional pairs of [docId, collectionName] for subcollection traversal.
 * @returns The resolved {@link CollectionReference} at the given path.
 * @throws Error if pathSegments length is odd (segments must come in pairs).
 *
 * @example
 * ```typescript
 * const ref = collectionRefForPath<User>(firestore, 'users');
 * const subRef = collectionRefForPath<Comment>(firestore, 'users', ['user123', 'comments']);
 * ```
 */
export function collectionRefForPath<T>(start: CollectionRefForPathInput, path: string, pathSegments?: string[]): CollectionReference<T> {
  let ref = start.collection(path);

  if (pathSegments?.length) {
    if (pathSegments.length % 2 !== 0) {
      throw new Error(`Invalid number of path segments provided for collection. Path: "${path}" + "${pathSegments}"`);
    }

    const batches = batch(pathSegments, 2); // batch to tuple [string, string]

    batches.forEach((x) => {
      const [first, second] = x;
      ref = (ref as unknown as DocRefSource).doc(first).collection(second);
    });
  }

  return ref as CollectionReference<T>;
}

/**
 * Resolves a Firestore {@link DocumentReference} from a starting point, optional document path, and additional path segments.
 *
 * If no path is provided, auto-generates a document ID. Supports nested subcollection
 * traversal via path segment pairs.
 *
 * @param start - A Firestore object that can resolve document paths (e.g., CollectionReference).
 * @param path - Optional document ID or path within the collection.
 * @param pathSegments - Optional pairs of [collectionName, docId] for subcollection traversal.
 * @returns The resolved {@link DocumentReference} at the given path.
 *
 * @example
 * ```typescript
 * const ref = docRefForPath<User>(usersCollection, 'user123');
 * const autoRef = docRefForPath<User>(usersCollection); // auto-generated ID
 * ```
 */
export function docRefForPath<T>(start: DocRefForPathInput, path?: string, pathSegments?: string[]): DocumentReference<T> {
  let doc = (path ? start.doc(path) : (start as GoogleCloudCollectionReference).doc()) as GoogleCloudDocumentReference;

  if (pathSegments?.length) {
    const batches = batch(pathSegments, 2); // batch to tuple [string, string]

    batches.forEach((x) => {
      const [first, second] = x;
      const collection = doc.collection(first);
      doc = second ? collection.doc(second) : collection.doc();
    });
  }

  return doc as DocumentReference<T>;
}

/**
 * Creates a {@link FirestoreAccessorDriver} for Google Cloud Firestore (Admin SDK).
 *
 * Implements document/collection resolution, transaction/batch factories, and context factories
 * using the `@google-cloud/firestore` library.
 *
 * @returns A {@link FirestoreAccessorDriver} for the Google Cloud Admin SDK.
 *
 * @example
 * ```typescript
 * const accessorDriver = googleCloudFirestoreAccessorDriver();
 * ```
 */
export function googleCloudFirestoreAccessorDriver(): FirestoreAccessorDriver {
  return {
    doc: <T>(collection: CollectionReference<T>, path?: string, ...pathSegments: string[]) => docRefForPath(collection as GoogleCloudCollectionReference, path, pathSegments) as DocumentReference<T>,
    docAtPath: <T>(firestore: Firestore, fullPath: string) => (firestore as GoogleCloudFirestore).doc(fullPath) as DocumentReference<T>,
    collectionGroup: <T>(firestore: Firestore, collectionId: string) => (firestore as GoogleCloudFirestore).collectionGroup(collectionId) as CollectionGroup<T>,
    collection: <T>(firestore: Firestore, path: string, ...pathSegments: string[]) => collectionRefForPath(firestore as GoogleCloudFirestore, path, pathSegments) as CollectionReference<T>,
    subcollection: <T>(document: DocumentReference, path: string, ...pathSegments: string[]) => collectionRefForPath(document as GoogleCloudDocumentReference, path, pathSegments) as CollectionReference<T>,
    transactionFactoryForFirestore:
      (firestore) =>
      async <T>(fn: TransactionFunction<T>) =>
        (firestore as GoogleCloudFirestore).runTransaction(fn),
    writeBatchFactoryForFirestore: (firestore) => () => (firestore as GoogleCloudFirestore).batch(),
    defaultContextFactory: defaultFirestoreDocumentContext,
    transactionContextFactory: transactionDocumentContext as TransactionFirestoreDocumentContextFactory,
    writeBatchContextFactory: writeBatchDocumentContext as unknown as WriteBatchFirestoreDocumentContextFactory
  };
}
