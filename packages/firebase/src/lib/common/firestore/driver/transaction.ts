import { type Firestore, type Transaction, type ReadOnlyTransactionOptions, type ReadWriteTransactionOptions } from '../types';

/**
 * Function that executes within a Firestore transaction context and returns a result.
 *
 * @template T - The return type of the transaction
 */
export type TransactionFunction<T = unknown> = (transaction: Transaction) => Promise<T>;

/**
 * Executes a Firestore transaction by creating a new {@link Transaction}, running the provided
 * function within it, and returning the result. Handles retries automatically on contention.
 *
 * **Important:** All transactions must include at least one read before any writes.
 * Omitting reads can leave the transaction in a bad state and defeats the idempotent
 * purpose of transactions.
 */
export type RunTransaction = <T>(fn: TransactionFunction<T>, options?: RunTransactionParams) => Promise<T>;

/**
 * Options for controlling transaction behavior — either read-only or read-write.
 */
export type RunTransactionParams = ReadOnlyTransactionOptions | ReadWriteTransactionOptions;

/**
 * Creates a {@link RunTransaction} function bound to the given Firestore instance.
 * Used by the driver layer to provide transaction capabilities per-Firestore.
 */
export type RunTransactionForFirestoreFactory = (firestore: Firestore) => RunTransaction;

/**
 * Holds a reference to a {@link RunTransaction} function for executing transactions.
 */
export interface RunTransactionFactoryReference {
  readonly runTransaction: RunTransaction;
}

/**
 * Driver component that provides {@link Transaction} execution for a Firestore instance.
 * Implemented by platform-specific drivers (Web SDK, Admin SDK).
 */
export interface FirestoreTransactionFactoryDriver {
  readonly transactionFactoryForFirestore: RunTransactionForFirestoreFactory;
}
