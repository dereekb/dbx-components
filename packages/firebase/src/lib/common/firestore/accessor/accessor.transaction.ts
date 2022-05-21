import { Transaction } from "../types";
import { FirestoreDocumentDataAccessorFactory } from "./accessor";

export type TransactionAccessorFactory<T = unknown> = (transaction: Transaction) => FirestoreDocumentDataAccessorFactory<T>;
