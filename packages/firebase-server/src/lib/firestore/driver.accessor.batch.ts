import { DocumentReference, WithFieldValue, WriteBatch, DocumentSnapshot, UpdateData as GoogleCloudUpdateData } from "@google-cloud/firestore";
import { from, Observable } from "rxjs";
import { FirestoreDocumentContext, FirestoreDocumentContextType, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, FirestoreDocumentDeleteParams, FirestoreDocumentUpdateParams, UpdateData } from "@dereekb/firebase";

// MARK: Accessor
/**
 * FirestoreDocumentDataAccessor implementation for a batch.
 */
export class WriteBatchFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {

  constructor(readonly batch: WriteBatch, readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<DocumentSnapshot<T>> {
    return from(this.get());  // todo
  }

  exists(): Promise<boolean> {
    return this.get().then(x => x.exists);
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.documentRef.get();
  }

  delete(params?: FirestoreDocumentDeleteParams): Promise<void> {
    this.batch.delete(this.documentRef, params?.precondition);
    return Promise.resolve();
  }

  set(data: WithFieldValue<T>): Promise<void> {
    this.batch.set(this.documentRef, data);
    return Promise.resolve();
  }

  update(data: UpdateData<T>, params?: FirestoreDocumentUpdateParams): Promise<void> {
    this.batch.update(this.documentRef, data as GoogleCloudUpdateData<T>, params?.precondition);
    return Promise.resolve();
  }

}

/**
 * Creates a new FirestoreDocumentDataAccessorFactory for a Batch.
 * 
 * @param batch 
 * @returns 
 */
export function writeBatchAccessorFactory<T>(writeBatch: WriteBatch): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new WriteBatchFirestoreDocumentDataAccessor(writeBatch, ref)
  };
}

// MARK: Context
export class WriteBatchFirestoreDocumentContext<T> implements FirestoreDocumentContext<T> {

  readonly contextType = FirestoreDocumentContextType.BATCH;
  readonly accessorFactory = writeBatchAccessorFactory<T>(this.batch);

  constructor(readonly batch: WriteBatch) { }

}

export function writeBatchDocumentContext<T>(batch: WriteBatch): WriteBatchFirestoreDocumentContext<T> {
  return new WriteBatchFirestoreDocumentContext<T>(batch);
}
