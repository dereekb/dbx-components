import { FirestoreAccessorDriver, CollectionReference, Firestore } from "@dereekb/firebase";
import { CollectionReference as GoogleCloudFirestoreCollection, Firestore as GoogleCloudFirestore } from "@google-cloud/firestore";
import { writeBatchDocumentContext } from "./driver.accessor.batch";
import { defaultFirestoreDocumentContext } from "./driver.accessor.default";
import { transactionDocumentContext } from "./driver.accessor.transaction";

export function firestoreClientAccessorDriver(): FirestoreAccessorDriver {
  return {
    doc: <T>(collection: CollectionReference<T>, path?: string) => (path) ? (collection as GoogleCloudFirestoreCollection).doc(path) : (collection as GoogleCloudFirestoreCollection).doc(),
    collection: <T>(firestore: Firestore, collectionPath: string) => (firestore as GoogleCloudFirestore).collection(collectionPath) as CollectionReference<T>,
    defaultContextFactory: defaultFirestoreDocumentContext,
    transactionContextFactory: transactionDocumentContext,
    writeBatchContextFactory: writeBatchDocumentContext
  };
}
