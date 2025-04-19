import { type Transaction } from '../types';
import { type FirestoreDocumentContext, type FirestoreDocumentContextType } from './context';

/**
 * Factory function type for creating transaction document contexts.
 *
 * This factory creates contexts that execute operations within a Firestore transaction,
 * providing atomicity guarantees across multiple read and write operations.
 *
 * @template T - The document data type that accessors from this context will work with
 * @param transaction - The Firestore transaction to execute operations within
 * @returns A FirestoreDocumentContext with transaction execution semantics
 */
export type TransactionFirestoreDocumentContextFactory = <T>(transaction: Transaction) => TransactionFirestoreDocumentContext<T>;

/**
 * Document context for operations executed within a Firestore transaction.
 *
 * This context ensures that document operations are performed as part of a transaction,
 * providing atomicity guarantees. Multiple operations performed through accessors from
 * this context will either all succeed or all fail together.
 *
 * Transactions in Firestore allow both reading and writing documents, and ensure that
 * reads reflect a consistent snapshot of the database that isn't affected by other
 * transactions until the current transaction completes.
 *
 * @template T - The document data type that accessors from this context will work with
 */
export interface TransactionFirestoreDocumentContext<T> extends FirestoreDocumentContext<T> {
  /**
   * The context type is always TRANSACTION, indicating transactional execution.
   */
  readonly contextType: FirestoreDocumentContextType.TRANSACTION;

  /**
   * The Firestore transaction that operations will be executed within.
   *
   * All operations performed through accessors from this context will be part of this transaction.
   */
  readonly transaction: Transaction;
}
