import { Firestore, Transaction, WriteBatch, ReadOnlyTransactionOptions, ReadWriteTransactionOptions } from './types';

export type TransactionFunction<T = any> = (transaction: Transaction) => Promise<T>;
export type WriteBatchFunction = () => WriteBatch;

export type RunTransactionFunctionParams = ReadOnlyTransactionOptions | ReadWriteTransactionOptions;
export type RunTransactionFunction = <T>(fn: TransactionFunction<T>, options?: RunTransactionFunctionParams) => Promise<T>;

export type TransactionFactoryFunction = (firestore: Firestore) => RunTransactionFunction;
export type WriteBatchFactoryFunction = (firestore: Firestore) => WriteBatchFunction;

export interface FirestoreTransactionFactory {
  readonly transactionFactoryForFirestore: TransactionFactoryFunction;
}

export interface FirestoreWriteBatchFactory {
  readonly writeBatchFactoryForFirestore: WriteBatchFactoryFunction;
}

export interface TransactionFactory {
  readonly runTransaction: RunTransactionFunction;
}

export interface WriteBatchFactory {
  readonly batch: WriteBatchFunction;
}
