import { type DocumentReference, type WriteBatch as GoogleCloudWriteBatch, type DocumentSnapshot } from '@google-cloud/firestore';
import { from, type Observable } from 'rxjs';
import { type WithFieldValue, type FirestoreDocumentContext, FirestoreDocumentContextType, type FirestoreDocumentDataAccessor, type FirestoreDocumentDataAccessorFactory, type FirestoreDocumentDeleteParams, type FirestoreDocumentUpdateParams, type UpdateData, type DocumentData, type FirestoreDataConverter, type FirestoreAccessorIncrementUpdate } from '@dereekb/firebase';
import { firestoreServerIncrementUpdateToUpdateData } from './increment';

// MARK: Accessor
/**
 * FirestoreDocumentDataAccessor implementation for a batch.
 */
export class WriteBatchFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  private readonly _batch: GoogleCloudWriteBatch;

  constructor(batch: GoogleCloudWriteBatch, readonly documentRef: DocumentReference<T>) {
    this._batch = batch;
  }

  get batch(): GoogleCloudWriteBatch {
    return this._batch;
  }

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
      this.batch.update<T, DocumentData>(this.documentRef, data as FirebaseFirestore.UpdateData<DocumentData>, params?.precondition);
    } else {
      this.batch.update<T, DocumentData>(this.documentRef, data as FirebaseFirestore.UpdateData<DocumentData>);
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
  private readonly _batch: GoogleCloudWriteBatch;

  readonly contextType = FirestoreDocumentContextType.BATCH;
  readonly accessorFactory: FirestoreDocumentDataAccessorFactory<T, DocumentData>;

  constructor(batch: GoogleCloudWriteBatch) {
    this._batch = batch;
    this.accessorFactory = writeBatchAccessorFactory<T>(batch);
  }

  get batch() {
    return this._batch;
  }
}

export function writeBatchDocumentContext<T>(batch: GoogleCloudWriteBatch): WriteBatchFirestoreDocumentContext<T> {
  return new WriteBatchFirestoreDocumentContext<T>(batch);
}
