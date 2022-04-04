import { Firestore, Transaction, WriteBatch, ReadOnlyTransactionOptions, ReadWriteTransactionOptions } from './types';

export type TransactionFunction<T> = (transaction: Transaction) => Promise<T>;

export type RunTransactionFunctionParams = ReadOnlyTransactionOptions | ReadWriteTransactionOptions;
export type RunTransactionFunction = <T>(fn: TransactionFunction<T>, options?: RunTransactionFunctionParams) => Promise<T>;

export type TransactionFactoryFunction = (firestore: Firestore) => RunTransactionFunction;
export type WriteBatchFactoryFunction = (firestore: Firestore) => WriteBatch;

export interface TransactionFactory {
  readonly transaction: TransactionFactoryFunction;
}

export interface WriteBatchFactory {
  readonly writeBatch: WriteBatchFactoryFunction;
}
