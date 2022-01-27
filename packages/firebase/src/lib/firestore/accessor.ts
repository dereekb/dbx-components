import { DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue } from "@firebase/firestore";
import { Observable } from 'rxjs';
import { FirestoreDocumentReference } from './reference';

export interface FirestoreDocumentDataAccessorStreamState<T> {
  isActiveStream: boolean;
  snapshot: DocumentSnapshot<T>;
}

/**
 * Firestore database accessor instance used to retrieve and make changes to items in the database.
 */
export interface FirestoreDocumentDataAccessor<T> extends FirestoreDocumentReference<T> {
  /**
   * Returns a database stream of this object.
   * 
   * Depending on the current context, the stream may not be active and return only the latest value.
   */
  stream(): Observable<FirestoreDocumentDataAccessorStreamState<T>>;
  /**
   * Returns the current snapshot.
   */
  get(): Promise<DocumentSnapshot<T>>;
  /**
   * Deletes the document
   */
  delete(): Promise<void>;
  /**
   * Sets the data in the database.
   * 
   * @param data 
   */
  set(data: WithFieldValue<T>): Promise<void>;
  /**
   * Updates the data in the database.
   * 
   * @param data 
   */
  update(data: UpdateData<T>): Promise<void>;
}

/**
 * Contextual interface used for making a FirestoreDocumentModifier for a specific document.
 */
export interface FirestoreDocumentDataAccessorFactory<T> {

  /**
   * Creates a new FirestoreDocumentDataAccessor for the input ref.
   * 
   * @param ref
   */
  accessorFor(ref: DocumentReference<T>): FirestoreDocumentDataAccessor<T>;

}
