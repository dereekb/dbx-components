import { DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue, docSnapshots, setDoc } from "@angular/fire/firestore";
import { deleteDoc, getDoc, updateDoc } from "@firebase/firestore";
import { map, Observable } from "rxjs";
import { FirestoreDocumentDatabaseAccessor, FirestoreDocumentDatabaseAccessorFactory, FirestoreDocumentDatabaseAccessorStreamState } from "./accessor";

/**
 * FirestoreDocumentDatabaseAccessor implementation for a batch.
 */
export class DefaultFirestoreDocumentDatabaseAccessor<T> implements FirestoreDocumentDatabaseAccessor<T> {

  constructor(readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<FirestoreDocumentDatabaseAccessorStreamState<T>> {
    return docSnapshots(this.documentRef).pipe(
      map(snapshot => ({ snapshot, isActiveStream: true }))
    );
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
 * Creates a new FirestoreDocumentDatabaseAccessorFactory for a Batch.
 * 
 * @param batch 
 * @returns 
 */
export function defaultFirestoreAccessorFactory<T>(): FirestoreDocumentDatabaseAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new DefaultFirestoreDocumentDatabaseAccessor(ref)
  };
}
