import { Transaction } from "@google-cloud/firestore";
import { transactionAccessorFactory } from "./accessor.transaction";
import { FirestoreDocumentContext, FirestoreDocumentContextType } from "./context";

// MARK: Transaction
export class TransactionFirestoreDocumentContext<T> implements FirestoreDocumentContext<T> {

  readonly contextType = FirestoreDocumentContextType.TRANSACTION;
  readonly accessorFactory = transactionAccessorFactory<T>(this.transaction);

  constructor(readonly transaction: Transaction) { }

}

export function transactionDocumentContext<T>(transaction: Transaction): TransactionFirestoreDocumentContext<T> {
  return new TransactionFirestoreDocumentContext<T>(transaction);
}
