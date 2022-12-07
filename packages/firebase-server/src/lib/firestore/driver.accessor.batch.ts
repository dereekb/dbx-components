import { DocumentReference, WriteBatch as GoogleCloudWriteBatch, DocumentSnapshot } from '@google-cloud/firestore';
import { from, Observable } from 'rxjs';
import { WithFieldValue, FirestoreDocumentContext, FirestoreDocumentContextType, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, FirestoreDocumentDeleteParams, FirestoreDocumentUpdateParams, UpdateData, DocumentData, FirestoreDataConverter, FirestoreAccessorIncrementUpdate } from '@dereekb/firebase';
import { firestoreServerIncrementUpdateToUpdateData } from './increment';

// MARK: Accessor
/**
 * FirestoreDocumentDataAccessor implementation for a batch.
 */
export class WriteBatchFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  constructor(readonly batch: GoogleCloudWriteBatch, readonly documentRef: DocumentReference<T>) {}

  stream(): Observable<DocumentSnapshot<T>> {
    return from(this.get()); // todo
  }

  create(data: WithFieldValue<T>): Promise<void> {
    this.batch.create(this.documentRef, data);
    return Promise.resolve();
  }

  exists(): Promise<boolean> {
    return this.get().then((x) => x.exists);
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.documentRef.get();
  }

  getWithConverter<U = DocumentData>(converter: null | FirestoreDataConverter<U>): Promise<DocumentSnapshot<U>> {
    return this.documentRef.withConverter<U>(converter as FirestoreDataConverter<U>).get();
  }

  delete(params?: FirestoreDocumentDeleteParams): Promise<void> {
    this.batch.delete(this.documentRef, params?.precondition);
    return Promise.resolve();
  }

  set(data: WithFieldValue<T>): Promise<void> {
    this.batch.set(this.documentRef, data);
    return Promise.resolve();
  }

  increment(data: FirestoreAccessorIncrementUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<void> {
    return this.update(firestoreServerIncrementUpdateToUpdateData(data), params);
  }

  update(data: UpdateData<object>, params?: FirestoreDocumentUpdateParams): Promise<void> {
    if (params?.precondition != null) {
      this.batch.update(this.documentRef, data as FirebaseFirestore.UpdateData<T>, params?.precondition);
    } else {
      this.batch.update(this.documentRef, data as FirebaseFirestore.UpdateData<T>);
    }

    return Promise.resolve();
  }
}

/**
 * Creates a new FirestoreDocumentDataAccessorFactory for a Batch.
 *
 * @param batch
 * @returns
 */
export function writeBatchAccessorFactory<T>(writeBatch: GoogleCloudWriteBatch): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new WriteBatchFirestoreDocumentDataAccessor(writeBatch, ref)
  };
}

// MARK: Context
export class WriteBatchFirestoreDocumentContext<T> implements FirestoreDocumentContext<T> {
  readonly contextType = FirestoreDocumentContextType.BATCH;
  readonly accessorFactory = writeBatchAccessorFactory<T>(this.batch);

  constructor(readonly batch: GoogleCloudWriteBatch) {}
}

export function writeBatchDocumentContext<T>(batch: GoogleCloudWriteBatch): WriteBatchFirestoreDocumentContext<T> {
  return new WriteBatchFirestoreDocumentContext<T>(batch);
}
