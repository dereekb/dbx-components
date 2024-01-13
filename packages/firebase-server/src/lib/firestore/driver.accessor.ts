import { type FirestoreAccessorDriver, type CollectionReference, type Firestore, type TransactionFunction, type DocumentReference, type TransactionFirestoreDocumentContextFactory, type WriteBatchFirestoreDocumentContextFactory } from '@dereekb/firebase';
import { batch } from '@dereekb/util';
import { type CollectionGroup, type CollectionReference as GoogleCloudCollectionReference, type DocumentReference as GoogleCloudDocumentReference, type Firestore as GoogleCloudFirestore } from '@google-cloud/firestore';
import { writeBatchDocumentContext } from './driver.accessor.batch';
import { defaultFirestoreDocumentContext } from './driver.accessor.default';
import { transactionDocumentContext } from './driver.accessor.transaction';

interface DocRefForPathInput {
  doc: (path: string) => DocumentReference;
}
interface CollectionRefForPathInput {
  collection: (path: string) => CollectionReference;
}
interface DocRefSource {
  doc: (path: string) => CollectionReference & CollectionRefForPathInput;
}

export function collectionRefForPath<T>(start: CollectionRefForPathInput, path: string, pathSegments?: string[]): CollectionReference<T> {
  let ref = start.collection(path);

  if (pathSegments?.length) {
    if (pathSegments?.length % 2 !== 0) {
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
        await (firestore as GoogleCloudFirestore).runTransaction(fn),
    writeBatchFactoryForFirestore: (firestore) => () => (firestore as GoogleCloudFirestore).batch(),
    defaultContextFactory: defaultFirestoreDocumentContext,
    transactionContextFactory: transactionDocumentContext as TransactionFirestoreDocumentContextFactory,
    writeBatchContextFactory: writeBatchDocumentContext as unknown as WriteBatchFirestoreDocumentContextFactory
  };
}
