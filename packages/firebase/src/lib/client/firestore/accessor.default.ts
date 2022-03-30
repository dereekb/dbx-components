import { DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue, setDoc, deleteDoc, getDoc, updateDoc } from "@firebase/firestore";
import { fromRef } from 'rxfire/firestore';
import { Observable } from "rxjs";
import { FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory } from "../../common/firestore";

/**
 * FirestoreDocumentDataAccessor implementation for a batch.
 */
export class DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {

  constructor(readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<DocumentSnapshot<T>> {
    return fromRef(this.documentRef);
  }

  get(): Promise<DocumentSnapshot<T>> {
    return getDoc(this.documentRef);
  }

  delete(): Promise<void> {
    return deleteDoc(this.documentRef);
  }

  set(data: WithFieldValue<T>): Promise<void> {
    return setDoc(this.documentRef, data);
  }

  update(data: UpdateData<T>): Promise<void> {
    return updateDoc(this.documentRef, data);
  }

}

/**
 * Creates a new FirestoreDocumentDataAccessorFactory for a Batch.
 * 
 * @param batch 
 * @returns 
 */
export function defaultFirestoreAccessorFactory<T>(): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new DefaultFirestoreDocumentDataAccessor(ref)
  };
}
