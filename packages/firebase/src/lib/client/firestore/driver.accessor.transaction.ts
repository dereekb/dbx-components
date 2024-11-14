import { type DocumentReference, type DocumentSnapshot, type Transaction as FirebaseFirestoreTransaction, type UpdateData, type WithFieldValue } from 'firebase/firestore';
import { from, type Observable } from 'rxjs';
import { type FirestoreDocumentDataAccessor, type FirestoreDocumentDataAccessorFactory, type FirestoreDocumentContext, FirestoreDocumentContextType, type SetOptions, type DocumentData, type FirestoreDataConverter, assertFirestoreUpdateHasData, type WriteResult, type FirestoreAccessorIncrementUpdate } from '../../common/firestore';
import { createWithAccessor } from './driver.accessor.create';
import { firestoreClientIncrementUpdateToUpdateData } from './increment';

// MARK: Accessor
/**
 * FirestoreDocumentDataAccessor implementation for a transaction.
 */
export class TransactionFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  private readonly _transaction: FirebaseFirestoreTransaction;
  private readonly _documentRef: DocumentReference<T>;

  constructor(transaction: FirebaseFirestoreTransaction, documentRef: DocumentReference<T>) {
    this._transaction = transaction;
    this._documentRef = documentRef;
  }

  get transaction(): FirebaseFirestoreTransaction {
    return this._transaction;
  }

  get documentRef(): DocumentReference<T> {
    return this._documentRef;
  }

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

  getWithConverter<U extends DocumentData = DocumentData>(converter: null | FirestoreDataConverter<U>): Promise<DocumentSnapshot<DocumentData, U>> {
    const withConverter = (converter != null ? this.documentRef.withConverter<U, DocumentData>(converter) : this.documentRef.withConverter(null)) as DocumentReference<U, DocumentData>;
    return this.transaction.get(withConverter) as Promise<DocumentSnapshot<DocumentData, U>>;
  }

  delete(): Promise<void> {
    this.transaction.delete(this.documentRef);
    return Promise.resolve();
  }

  set(data: WithFieldValue<T>, options?: SetOptions): Promise<void> {
    this.transaction.set(this.documentRef, data, options as SetOptions);
    return Promise.resolve();
  }

  increment(data: FirestoreAccessorIncrementUpdate<T>): Promise<void | WriteResult> {
    return this.update(firestoreClientIncrementUpdateToUpdateData(data));
  }

  update(data: UpdateData<object>): Promise<void> {
    assertFirestoreUpdateHasData(data);
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
  private readonly _transaction: FirebaseFirestoreTransaction;

  readonly contextType = FirestoreDocumentContextType.TRANSACTION;
  readonly accessorFactory: FirestoreDocumentDataAccessorFactory<T>;

  constructor(transaction: FirebaseFirestoreTransaction) {
    this._transaction = transaction;
    this.accessorFactory = transactionAccessorFactory<T>(transaction);
  }

  get transaction(): FirebaseFirestoreTransaction {
    return this._transaction;
  }
}

export function transactionDocumentContext<T>(transaction: FirebaseFirestoreTransaction): TransactionFirestoreDocumentContext<T> {
  return new TransactionFirestoreDocumentContext<T>(transaction);
}
