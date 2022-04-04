import { DocumentReference, DocumentSnapshot, getDoc, WriteBatch as FirebaseFirestoreWriteBatch } from "@firebase/firestore";
import { from, Observable } from "rxjs";
import { FirestoreDocumentContext, UpdateData, WithFieldValue, FirestoreDocumentContextType, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, SetOptions } from "../../common/firestore";

// MARK: Accessor
/**
 * FirestoreDocumentDataAccessor implementation for a batch.
 */
export class WriteBatchFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {

  constructor(readonly batch: FirebaseFirestoreWriteBatch, readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<DocumentSnapshot<T>> {
    return from(this.get());
  }

  exists(): Promise<boolean> {
    return this.get().then(x => x.exists());
  }

  get(): Promise<DocumentSnapshot<T>> {
    return getDoc(this.documentRef);
  }

  delete(): Promise<void> {
    this.batch.delete(this.documentRef);
    return Promise.resolve();
  }

  set(data: WithFieldValue<T>, options?: SetOptions): Promise<void> {
    this.batch.set(this.documentRef, data, options as SetOptions);
    return Promise.resolve();
  }

  update(data: UpdateData<T>): Promise<void> {
    this.batch.update(this.documentRef, data as any);
    return Promise.resolve();
  }

}

/**
 * Creates a new FirestoreDocumentDataAccessorFactory for a Batch.
 * 
 * @param batch 
 * @returns 
 */
export function writeBatchAccessorFactory<T>(writeBatch: FirebaseFirestoreWriteBatch): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new WriteBatchFirestoreDocumentDataAccessor(writeBatch, ref)
  };
}

// MARK: Context
export class WriteBatchFirestoreDocumentContext<T> implements FirestoreDocumentContext<T> {

  readonly contextType = FirestoreDocumentContextType.BATCH;
  readonly accessorFactory = writeBatchAccessorFactory<T>(this.batch);

  constructor(readonly batch: FirebaseFirestoreWriteBatch) { }

}

export function writeBatchDocumentContext<T>(batch: FirebaseFirestoreWriteBatch): WriteBatchFirestoreDocumentContext<T> {
  return new WriteBatchFirestoreDocumentContext<T>(batch);
}
