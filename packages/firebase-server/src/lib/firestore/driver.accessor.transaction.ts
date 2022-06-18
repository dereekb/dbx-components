import { DocumentReference, DocumentSnapshot, Transaction as GoogleCloudTransaction, SetOptions } from '@google-cloud/firestore';
import { from, Observable } from 'rxjs';
import { WithFieldValue, UpdateData, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, FirestoreDocumentContext, FirestoreDocumentContextType, FirestoreDocumentUpdateParams, FirestoreDataConverter, DocumentData, unsupportedFirestoreDriverFunctionError } from '@dereekb/firebase';

// MARK: Accessor
/**
 * FirestoreDocumentDataAccessor implementation for a transaction.
 */
export class TransactionFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  constructor(readonly transaction: GoogleCloudTransaction, readonly documentRef: DocumentReference<T>) {}

  stream(): Observable<DocumentSnapshot<T>> {
    return from(this.get());
  }

  create(data: WithFieldValue<T>): Promise<void> {
    this.transaction.create(this.documentRef, data);
    return Promise.resolve();
  }

  exists(): Promise<boolean> {
    return this.get().then((x) => x.exists);
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.transaction.get(this.documentRef);
  }

  getWithConverter<U = DocumentData>(converter: null | FirestoreDataConverter<U>): Promise<DocumentSnapshot<U>> {
    return this.transaction.get(this.documentRef.withConverter<U>(converter as FirestoreDataConverter<U>));
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
    this.transaction.update(this.documentRef, data as FirebaseFirestore.UpdateData<T>, params?.precondition ?? { exists: true });
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
