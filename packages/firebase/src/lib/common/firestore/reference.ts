import { CollectionReference, DocumentReference } from "./types";

/**
 * Contains a reference to a CollectionReference.
 */
export interface FirestoreCollectionReference<T> {
  readonly collection: CollectionReference<T>;
}

/**
 * Contains a reference to a DocumentReference.
 */
export interface FirestoreDocumentReference<T> {
  readonly documentRef: DocumentReference<T>;
}
