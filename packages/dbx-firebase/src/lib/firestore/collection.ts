import { CollectionReference } from "@firebase/firestore";

/**
 * Contains a reference to a CollectionReference.
 */
export interface DbNgxFirestoreCollectionReference<T> {
  readonly collection: CollectionReference<T>;
}
