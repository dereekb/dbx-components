import { DocumentReference, DocumentSnapshot, Transaction, UpdateData, WithFieldValue } from "@firebase/firestore";
import { from, Observable } from "rxjs";
import { FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, FirestoreDocumentContext, FirestoreDocumentContextType } from "../../common/firestore";

// MARK: Accessor
/**
 * FirestoreDocumentDataAccessor implementation for a transaction.
 */
export class TransactionFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {

  constructor(readonly transaction: Transaction, readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<DocumentSnapshot<T>> {
    return from(this.get());
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.transaction.get(this.documentRef);
  }

  delete(): Promise<void> {
    this.transaction.delete(this.documentRef);
    return Promise.resolve();
  }

  set(data: WithFieldValue<T>): Promise<void> {
    this.transaction.set(this.documentRef, data);
    return Promise.resolve();
  }

  update(data: UpdateData<T>): Promise<void> {
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
export function transactionAccessorFactory<T>(transaction: Transaction): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new TransactionFirestoreDocumentDataAccessor(transaction, ref)
  };
}

// MARK: Context
export class TransactionFirestoreDocumentContext<T> implements FirestoreDocumentContext<T> {

  readonly contextType = FirestoreDocumentContextType.TRANSACTION;
  readonly accessorFactory = transactionAccessorFactory<T>(this.transaction);

  constructor(readonly transaction: Transaction) { }

}

export function transactionDocumentContext<T>(transaction: Transaction): TransactionFirestoreDocumentContext<T> {
  return new TransactionFirestoreDocumentContext<T>(transaction);
}
