import { type DocumentReference, type DocumentSnapshot, type Transaction as GoogleCloudTransaction, type SetOptions } from '@google-cloud/firestore';
import { from, type Observable } from 'rxjs';
import { type WithFieldValue, type UpdateData, type FirestoreDocumentDataAccessor, type FirestoreDocumentDataAccessorFactory, type FirestoreDocumentContext, FirestoreDocumentContextType, type FirestoreDocumentUpdateParams, type FirestoreDataConverter, type DocumentData, type FirestoreAccessorIncrementUpdate } from '@dereekb/firebase';
import { firestoreServerIncrementUpdateToUpdateData } from './increment';

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

  increment(data: FirestoreAccessorIncrementUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<void> {
    return this.update(firestoreServerIncrementUpdateToUpdateData(data), params);
  }

  update(data: UpdateData<object>, params?: FirestoreDocumentUpdateParams): Promise<void> {
    if (params?.precondition) {
      this.transaction.update<T, DocumentData>(this.documentRef, data as FirebaseFirestore.UpdateData<DocumentData>, params?.precondition);
    } else {
      this.transaction.update<T, DocumentData>(this.documentRef, data as FirebaseFirestore.UpdateData<DocumentData>);
    }

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
