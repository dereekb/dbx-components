import { DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue, WriteBatch } from "@angular/fire/firestore";
import { getDoc } from "@firebase/firestore";
import { from, Observable } from "rxjs";
import { FirestoreDocumentDatabaseAccessor, FirestoreDocumentDatabaseAccessorFactory, FirestoreDocumentDatabaseAccessorStreamState } from "./accessor";

/**
 * FirestoreDocumentDatabaseAccessor implementation for a batch.
 */
export class WriteBatchFirestoreDocumentDatabaseAccessor<T> implements FirestoreDocumentDatabaseAccessor<T> {

  constructor(readonly batch: WriteBatch, readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<FirestoreDocumentDatabaseAccessorStreamState<T>> {
    return from(this.get().then(snapshot => ({ snapshot, isActiveStream: false })));
  }

  get(): Promise<DocumentSnapshot<T>> {
    return getDoc(this.documentRef);
  }

  delete(): Promise<void> {
    this.batch.delete(this.documentRef);
    return Promise.resolve();
  }

  set(data: WithFieldValue<T>): Promise<void> {
    this.batch.set(this.documentRef, data);
    return Promise.resolve();
  }

  update(data: UpdateData<T>): Promise<void> {
    this.batch.update(this.documentRef, data);
    return Promise.resolve();
  }

}

/**
 * Creates a new FirestoreDocumentDatabaseAccessorFactory for a Batch.
 * 
 * @param batch 
 * @returns 
 */
export function writeBatchAccessorFactory<T>(writeBatch: WriteBatch): FirestoreDocumentDatabaseAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new WriteBatchFirestoreDocumentDatabaseAccessor(writeBatch, ref)
  };
}
