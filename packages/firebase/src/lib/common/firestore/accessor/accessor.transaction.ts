import { Transaction } from "../types";
import { FirestoreDocumentDataAccessorFactory } from "./accessor";

export type TransactionAccessorFactory<T = any> = (transaction: Transaction) => FirestoreDocumentDataAccessorFactory<T>;
