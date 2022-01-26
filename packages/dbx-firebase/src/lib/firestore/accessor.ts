import { Observable } from 'rxjs';
import { DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue } from '@angular/fire/firestore';

export interface FirestoreDocumentDatabaseAccessorStreamState<T> {
  isActiveStream: boolean;
  snapshot: DocumentSnapshot<T>;
}

export interface FirestoreDocumentDatabaseAccessorDocumentRef<T> {
  readonly documentRef: DocumentReference<T>;
}

/**
 * Firestore database accessor instance used to retrieve and make changes to items in the database.
 */
export interface FirestoreDocumentDatabaseAccessor<T> extends FirestoreDocumentDatabaseAccessorDocumentRef<T> {
  /**
   * Returns a database stream of this object.
   * 
   * Depending on the current context, the stream may not be active and return only the latest value.
   */
  stream(): Observable<FirestoreDocumentDatabaseAccessorStreamState<T>>;
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
export interface FirestoreDocumentDatabaseAccessorFactory<T> {

  /**
   * Creates a new FirestoreDocumentDatabaseAccessor for the input ref.
   * 
   * @param ref
   */
  accessorFor(ref: DocumentReference<T>): FirestoreDocumentDatabaseAccessor<T>;

}
