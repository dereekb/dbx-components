import { DocumentReference, DocumentSnapshot, Transaction, UpdateData, WithFieldValue } from "@angular/fire/firestore";
import { from, Observable } from "rxjs";
import { FirestoreDocumentDatabaseAccessor, FirestoreDocumentDatabaseAccessorFactory, FirestoreDocumentDatabaseAccessorStreamState } from "./accessor";

/**
 * FirestoreDocumentDatabaseAccessor implementation for a transaction.
 */
export class TransactionFirestoreDocumentDatabaseAccessor<T> implements FirestoreDocumentDatabaseAccessor<T> {

  constructor(readonly transaction: Transaction, readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<FirestoreDocumentDatabaseAccessorStreamState<T>> {
    return from(this.get().then(snapshot => ({ snapshot, isActiveStream: false })));
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
 * Creates a new FirestoreDocumentDatabaseAccessorFactory for a Transaction.
 * 
 * @param transaction 
 * @returns 
 */
export function transactionAccessorFactory<T>(transaction: Transaction): FirestoreDocumentDatabaseAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new TransactionFirestoreDocumentDatabaseAccessor(transaction, ref)
  };
}
