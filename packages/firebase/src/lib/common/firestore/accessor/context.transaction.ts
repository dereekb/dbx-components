import { Transaction } from "../types";
import { FirestoreDocumentContext, FirestoreDocumentContextType } from "./context";

export type TransactionFirestoreDocumentContextFactory = <T>(transaction: Transaction) => TransactionFirestoreDocumentContext<T>;

export interface TransactionFirestoreDocumentContext<T> extends FirestoreDocumentContext<T> {
  readonly contextType: FirestoreDocumentContextType.TRANSACTION;
  readonly transaction: Transaction;
}
