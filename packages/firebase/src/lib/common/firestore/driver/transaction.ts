import { Firestore, Transaction, ReadOnlyTransactionOptions, ReadWriteTransactionOptions } from '../types';

/**
 * Function that runs in a transaction context and returns a value.
 */
export type TransactionFunction<T = any> = (transaction: Transaction) => Promise<T>;


/**
 * Factory for running transactions. Creates a new Transaction, runs it with the input TransactionFunction, and returns the result.
 */
export type RunTransaction = <T>(fn: TransactionFunction<T>, options?: RunTransactionParams) => Promise<T>;
export type RunTransactionParams = ReadOnlyTransactionOptions | ReadWriteTransactionOptions;

/**
 * Factory for making a RunTransactionFunction for the input Firestore.
 */
export type RunTransactionForFirestoreFactory = (firestore: Firestore) => RunTransaction;


export interface RunTransactionFactoryReference {
  readonly runTransaction: RunTransaction;
}

/**
 * Driver for prividing a RunTransactionForFirestoreFactory
 */
export interface FirestoreTransactionFactoryDriver {
  readonly transactionFactoryForFirestore: RunTransactionForFirestoreFactory;
}
