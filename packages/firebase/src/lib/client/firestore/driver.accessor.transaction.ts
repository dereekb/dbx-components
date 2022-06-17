import { DocumentReference, DocumentSnapshot, Transaction as FirebaseFirestoreTransaction, UpdateData, WithFieldValue } from '@firebase/firestore';
import { from, Observable } from 'rxjs';
import { FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, FirestoreDocumentContext, FirestoreDocumentContextType, SetOptions, DocumentData, FirestoreDataConverter } from '../../common/firestore';
import { createWithAccessor } from './driver.accessor.create';

// MARK: Accessor
/**
 * FirestoreDocumentDataAccessor implementation for a transaction.
 */
export class TransactionFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  constructor(readonly transaction: FirebaseFirestoreTransaction, readonly documentRef: DocumentReference<T>) {}

  stream(): Observable<DocumentSnapshot<T>> {
    return from(this.get());
  }

  create(data: WithFieldValue<T>): Promise<void> {
    return createWithAccessor(this)(data) as Promise<void>;
  }

  exists(): Promise<boolean> {
    return this.get().then((x) => x.exists());
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.transaction.get(this.documentRef);
  }

  getWithConverter<U = DocumentData>(converter: null | FirestoreDataConverter<U>): Promise<DocumentSnapshot<U>> {
    return this.transaction.get(this.documentRef.withConverter<U>(converter as FirestoreDataConverter<U>)) as Promise<DocumentSnapshot<U>>;
  }

  delete(): Promise<void> {
    this.transaction.delete(this.documentRef);
    return Promise.resolve();
  }

  set(data: WithFieldValue<T>, options?: SetOptions): Promise<void> {
    this.transaction.set(this.documentRef, data, options as SetOptions);
    return Promise.resolve();
  }

  update(data: UpdateData<unknown>): Promise<void> {
    this.transaction.update(this.documentRef, data);
    return Promise.resolve();
  }
}

/**
 * Creates a new FirestoreDocumentDataAccessorFactory for a Transaction.
 *
 * @param transaction
 * @returns
 */
export function transactionAccessorFactory<T>(transaction: FirebaseFirestoreTransaction): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new TransactionFirestoreDocumentDataAccessor(transaction, ref)
  };
}

// MARK: Context
export class TransactionFirestoreDocumentContext<T> implements FirestoreDocumentContext<T> {
  readonly contextType = FirestoreDocumentContextType.TRANSACTION;
  readonly accessorFactory = transactionAccessorFactory<T>(this.transaction);

  constructor(readonly transaction: FirebaseFirestoreTransaction) {}
}

export function transactionDocumentContext<T>(transaction: FirebaseFirestoreTransaction): TransactionFirestoreDocumentContext<T> {
  return new TransactionFirestoreDocumentContext<T>(transaction);
}
