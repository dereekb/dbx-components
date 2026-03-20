import { type DocumentReference, type WriteBatch as GoogleCloudWriteBatch, type DocumentSnapshot } from '@google-cloud/firestore';
import { from, type Observable } from 'rxjs';
import { type WithFieldValue, type FirestoreDocumentContext, FirestoreDocumentContextType, type FirestoreDocumentDataAccessor, type FirestoreDocumentDataAccessorFactory, type FirestoreDocumentDeleteParams, type FirestoreDocumentUpdateParams, type UpdateData, type DocumentData, type FirestoreDataConverter, type FirestoreAccessorIncrementUpdate, type FirestoreAccessorArrayUpdate } from '@dereekb/firebase';
import { firestoreServerIncrementUpdateToUpdateData } from './increment';
import { firestoreServerArrayUpdateToUpdateData } from './array';

// MARK: Accessor
/**
 * Google Cloud Firestore implementation of {@link FirestoreDocumentDataAccessor} that queues
 * all write operations (create, set, update, delete) into a {@link WriteBatch}.
 *
 * Writes are not committed until the batch is explicitly committed. Read operations
 * (get, exists) bypass the batch and read directly from Firestore.
 */
export class WriteBatchFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  private readonly _batch: GoogleCloudWriteBatch;

  constructor(
    batch: GoogleCloudWriteBatch,
    readonly documentRef: DocumentReference<T>
  ) {
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

  arrayUpdate(data: FirestoreAccessorArrayUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<void> {
    return this.update(firestoreServerArrayUpdateToUpdateData(data), params);
  }

  update(data: UpdateData<object>, params?: FirestoreDocumentUpdateParams): Promise<void> {
    if (params?.precondition != null) {
      this.batch.update<T, DocumentData>(this.documentRef, data as FirebaseFirestore.UpdateData<DocumentData>, params.precondition);
    } else {
      this.batch.update<T, DocumentData>(this.documentRef, data as FirebaseFirestore.UpdateData<DocumentData>);
    }

    return Promise.resolve();
  }
}

/**
 * Creates a {@link FirestoreDocumentDataAccessorFactory} that produces batch-backed accessors.
 *
 * All accessors created from this factory share the same {@link WriteBatch}, so committing
 * the batch applies all queued writes atomically.
 *
 * @param writeBatch - The Google Cloud WriteBatch to queue operations into.
 * @returns A factory that creates batch-backed accessors sharing the given WriteBatch.
 *
 * @example
 * ```typescript
 * const batch = firestore.batch();
 * const factory = writeBatchAccessorFactory<User>(batch);
 * const accessor = factory.accessorFor(userDocRef);
 * await accessor.set({ name: 'Alice' });
 * await batch.commit();
 * ```
 */
export function writeBatchAccessorFactory<T>(writeBatch: GoogleCloudWriteBatch): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new WriteBatchFirestoreDocumentDataAccessor(writeBatch, ref)
  };
}

// MARK: Context
/**
 * A {@link FirestoreDocumentContext} backed by a Google Cloud {@link WriteBatch}.
 *
 * All document accessors created from this context queue writes into the same batch.
 */
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

/**
 * Creates a {@link WriteBatchFirestoreDocumentContext} wrapping the given batch.
 *
 * @param batch - The Google Cloud WriteBatch to use.
 * @returns A new {@link WriteBatchFirestoreDocumentContext} for the given batch.
 */
export function writeBatchDocumentContext<T>(batch: GoogleCloudWriteBatch): WriteBatchFirestoreDocumentContext<T> {
  return new WriteBatchFirestoreDocumentContext<T>(batch);
}
