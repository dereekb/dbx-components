import { Firestore, Transaction, ReadOnlyTransactionOptions, ReadWriteTransactionOptions } from '../types';

/**
 * Function that runs in a transaction context and returns a value.
 */
export type TransactionFunction<T = unknown> = (transaction: Transaction) => Promise<T>;

/**
 * Factory for running transactions. Creates a new Transaction, runs it with the input TransactionFunction, and returns the result.
 * 
 * All transactions require a read. The read should occur before any writes occur. Not reading within a Transaction can leave 
 * the transaction in a bad state. (It also defeats the idempotent purpose of transactions!)
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
