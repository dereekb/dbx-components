import { CollectionReference, DocumentReference } from "./types";

/**
 * Contains a reference to a CollectionReference.
 */
export interface CollectionReferenceRef<T> {
  readonly collection: CollectionReference<T>;
}

/**
 * Contains a reference to a DocumentReference.
 */
export interface DocumentReferenceRef<T> {
  readonly documentRef: DocumentReference<T>;
}
