import { FirestoreAccessorDriver, CollectionReference, Firestore, TransactionFunction } from "@dereekb/firebase";
import { CollectionReference as GoogleCloudFirestoreCollection, Firestore as GoogleCloudFirestore } from "@google-cloud/firestore";
import { writeBatchDocumentContext } from "./driver.accessor.batch";
import { defaultFirestoreDocumentContext } from "./driver.accessor.default";
import { transactionDocumentContext } from "./driver.accessor.transaction";

export function firestoreClientAccessorDriver(): FirestoreAccessorDriver {
  return {
    doc: <T>(collection: CollectionReference<T>, path?: string) => (path) ? (collection as GoogleCloudFirestoreCollection).doc(path) : (collection as GoogleCloudFirestoreCollection).doc(),
    collection: <T>(firestore: Firestore, collectionPath: string) => (firestore as GoogleCloudFirestore).collection(collectionPath) as CollectionReference<T>,
    transaction: (firestore) => async <T>(fn: TransactionFunction<T>) => (firestore as GoogleCloudFirestore).runTransaction(fn),
    writeBatch: (firestore) => (firestore as GoogleCloudFirestore).batch(),
    defaultContextFactory: defaultFirestoreDocumentContext,
    transactionContextFactory: transactionDocumentContext as any,
    writeBatchContextFactory: writeBatchDocumentContext as any
  };
}
