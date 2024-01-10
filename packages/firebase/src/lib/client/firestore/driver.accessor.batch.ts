import { DocumentReference, WriteBatch as FirebaseFirestoreWriteBatch, UpdateData as FirestoreUpdateData } from '@firebase/firestore';
import { FirestoreDocumentContext, UpdateData, WithFieldValue, FirestoreDocumentContextType, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, SetOptions, assertFirestoreUpdateHasData } from '../../common/firestore';
import { DefaultFirestoreDocumentDataAccessor } from './driver.accessor.default';

// MARK: Accessor
/**
 * FirestoreDocumentDataAccessor implementation for a batch.
 */
export class WriteBatchFirestoreDocumentDataAccessor<T> extends DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  constructor(readonly batch: FirebaseFirestoreWriteBatch, documentRef: DocumentReference<T>) {
    super(documentRef);
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

  constructor(readonly batch: FirebaseFirestoreWriteBatch) {}
}

export function writeBatchDocumentContext<T>(batch: FirebaseFirestoreWriteBatch): WriteBatchFirestoreDocumentContext<T> {
  return new WriteBatchFirestoreDocumentContext<T>(batch);
}
