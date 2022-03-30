import { DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue } from "@google-cloud/firestore";
import { fromRef } from 'rxfire/firestore';
import { map, Observable } from "rxjs";
import { FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory } from "./accessor";

/**
 * FirestoreDocumentDataAccessor implementation for a batch.
 */
export class DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {

  constructor(readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<DocumentSnapshot<T>> {
    return fromRef(this.documentRef);
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.documentRef.get();
  }

  delete(): Promise<FirebaseFirestore.WriteResult> {
    return this.documentRef.delete(undefined);
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
