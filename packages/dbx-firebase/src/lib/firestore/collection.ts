import { CollectionReference } from "@firebase/firestore";

/**
 * Contains a reference to a CollectionReference.
 */
export interface FirestoreCollectionReference<T> {
  readonly collection: CollectionReference<T>;
}
