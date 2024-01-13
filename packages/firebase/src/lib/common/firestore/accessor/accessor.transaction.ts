import { type Transaction } from '../types';
import { type FirestoreDocumentDataAccessorFactory } from './accessor';

export type TransactionAccessorFactory<T = unknown> = (transaction: Transaction) => FirestoreDocumentDataAccessorFactory<T>;
