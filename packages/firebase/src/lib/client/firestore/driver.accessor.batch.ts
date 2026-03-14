import { type DocumentReference, type WriteBatch as FirebaseFirestoreWriteBatch, type UpdateData as FirestoreUpdateData } from 'firebase/firestore';
import { type FirestoreDocumentContext, type UpdateData, type DocumentData, type WithFieldValue, FirestoreDocumentContextType, type FirestoreDocumentDataAccessor, type FirestoreDocumentDataAccessorFactory, type SetOptions, assertFirestoreUpdateHasData } from '../../common/firestore';
import { DefaultFirestoreDocumentDataAccessor } from './driver.accessor.default';

// MARK: Accessor
/**
 * Client-side {@link FirestoreDocumentDataAccessor} that queues write operations into a Firestore `WriteBatch`.
 *
 * Extends {@link DefaultFirestoreDocumentDataAccessor} to override `delete`, `set`, and `update` so they
 * add operations to the batch rather than executing immediately. Read operations (`get`, `stream`, `exists`)
 * still execute directly against Firestore. The batch must be committed separately after all operations are queued.
 */
export class WriteBatchFirestoreDocumentDataAccessor<T> extends DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  private readonly _batch: FirebaseFirestoreWriteBatch;

  constructor(batch: FirebaseFirestoreWriteBatch, documentRef: DocumentReference<T>) {
    super(documentRef);
    this._batch = batch;
  }

  get batch(): FirebaseFirestoreWriteBatch {
    return this._batch;
  }

  override delete(): Promise<void> {
    this.batch.delete(this.documentRef);
    return Promise.resolve();
  }

  override set(data: WithFieldValue<T>, options?: SetOptions): Promise<void> {
    this.batch.set(this.documentRef, data, options as SetOptions);
    return Promise.resolve();
  }

  override update(data: UpdateData<object>): Promise<void> {
    assertFirestoreUpdateHasData(data);
    this.batch.update(this.documentRef, data as FirestoreUpdateData<object>);
    return Promise.resolve();
  }
}

/**
 * Creates a {@link FirestoreDocumentDataAccessorFactory} that produces {@link WriteBatchFirestoreDocumentDataAccessor}
 * instances bound to the given `WriteBatch`. All write operations from these accessors are queued
 * into the same batch.
 *
 * @param writeBatch - the Firestore `WriteBatch` to queue operations into
 *
 * @example
 * ```ts
 * const batch = writeBatch(firestore);
 * const factory = writeBatchAccessorFactory<MyModel>(batch);
 * const accessor = factory.accessorFor(docRef);
 * await accessor.set(data);
 * await batch.commit();
 * ```
 */
export function writeBatchAccessorFactory<T>(writeBatch: FirebaseFirestoreWriteBatch): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new WriteBatchFirestoreDocumentDataAccessor(writeBatch, ref)
  };
}

// MARK: Context
/**
 * Client-side {@link FirestoreDocumentContext} that groups all document operations into a single `WriteBatch`.
 *
 * Provides accessors with {@link FirestoreDocumentContextType.BATCH} semantics — writes are queued
 * and only applied when the batch is committed.
 */
export class WriteBatchFirestoreDocumentContext<T> implements FirestoreDocumentContext<T> {
  private readonly _batch: FirebaseFirestoreWriteBatch;

  readonly contextType = FirestoreDocumentContextType.BATCH;
  readonly accessorFactory: FirestoreDocumentDataAccessorFactory<T, DocumentData>;

  constructor(batch: FirebaseFirestoreWriteBatch) {
    this._batch = batch;
    this.accessorFactory = writeBatchAccessorFactory<T>(batch);
  }

  get batch() {
    return this._batch;
  }
}

/**
 * Factory function that creates a {@link WriteBatchFirestoreDocumentContext} for the given batch.
 *
 * @param batch - the Firestore `WriteBatch` to use for all document operations
 *
 * @example
 * ```ts
 * const batch = writeBatch(firestore);
 * const context = writeBatchDocumentContext<MyModel>(batch);
 * ```
 */
export function writeBatchDocumentContext<T>(batch: FirebaseFirestoreWriteBatch): WriteBatchFirestoreDocumentContext<T> {
  return new WriteBatchFirestoreDocumentContext<T>(batch);
}
