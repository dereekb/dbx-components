import { Transaction } from "@firebase/firestore";
import { transactionAccessorFactory } from "./accessor.transaction";
import { FirestoreDocumentDatabaseContext, FirestoreDocumentDatabaseContextType } from "./context";

// MARK: Transaction
export class TransactionFirestoreDocumentDatabaseContext<T> implements FirestoreDocumentDatabaseContext<T> {

  readonly contextType = FirestoreDocumentDatabaseContextType.TRANSACTION;
  readonly accessorFactory = transactionAccessorFactory<T>(this.transaction);

  constructor(readonly transaction: Transaction) { }

}

export function transactionDatabaseContext<T>(transaction: Transaction): TransactionFirestoreDocumentDatabaseContext<T> {
  return new TransactionFirestoreDocumentDatabaseContext<T>(transaction);
}
