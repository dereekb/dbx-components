import { DocumentReference, DocumentSnapshot, Transaction as GoogleCloudTransaction, SetOptions } from '@google-cloud/firestore';
import { from, Observable } from 'rxjs';
import { WithFieldValue, UpdateData, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, FirestoreDocumentContext, FirestoreDocumentContextType, FirestoreDocumentUpdateParams } from '@dereekb/firebase';

// MARK: Accessor
/**
 * FirestoreDocumentDataAccessor implementation for a transaction.
 */
export class TransactionFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  constructor(readonly transaction: GoogleCloudTransaction, readonly documentRef: DocumentReference<T>) {}

  stream(): Observable<DocumentSnapshot<T>> {
    return from(this.get());
  }

  exists(): Promise<boolean> {
    return this.get().then((x) => x.exists);
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.transaction.get(this.documentRef);
  }

  delete(): Promise<void> {
    this.transaction.delete(this.documentRef);
    return Promise.resolve();
  }

  set(data: WithFieldValue<T>, options?: SetOptions): Promise<void> {
    this.transaction.set(this.documentRef, data as Partial<T>, options as SetOptions);
    return Promise.resolve();
  }

  update(data: UpdateData<T>, params?: FirestoreDocumentUpdateParams): Promise<void> {
    this.transaction.update(this.documentRef, data as Partial<T>, params?.precondition ?? {});
    return Promise.resolve();
  }
}

/**
 * Creates a new FirestoreDocumentDataAccessorFactory for a Transaction.
 *
 * @param transaction
 * @returns
 */
export function transactionAccessorFactory<T>(transaction: GoogleCloudTransaction): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new TransactionFirestoreDocumentDataAccessor(transaction, ref)
  };
}

// MARK: Context
export class TransactionFirestoreDocumentContext<T> implements FirestoreDocumentContext<T> {
  readonly contextType = FirestoreDocumentContextType.TRANSACTION;
  readonly accessorFactory = transactionAccessorFactory<T>(this.transaction);

  constructor(readonly transaction: GoogleCloudTransaction) {}
}

export function transactionDocumentContext<T>(transaction: GoogleCloudTransaction): TransactionFirestoreDocumentContext<T> {
  return new TransactionFirestoreDocumentContext<T>(transaction);
}
