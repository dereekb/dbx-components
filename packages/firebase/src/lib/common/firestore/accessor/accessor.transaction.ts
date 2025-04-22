import { type Transaction } from '../types';
import { type FirestoreDocumentDataAccessorFactory } from './accessor';

/**
 * Factory function type for creating document accessor factories that operate within a transaction.
 *
 * This is a higher-order factory that takes a Firestore Transaction and returns a document
 * accessor factory. All document accessors created by the returned factory will perform
 * their read and write operations as part of the specified transaction, providing atomicity
 * and consistency guarantees across multiple documents and operations.
 *
 * Unlike write batches, transactions support both read and write operations and ensure
 * that reads reflect a consistent snapshot of the database.
 *
 * @template T - The document data type that accessors will work with
 * @param transaction - The Firestore transaction to execute operations within
 * @returns A factory for creating document accessors that operate within the specified transaction
 */
export type TransactionAccessorFactory<T = unknown> = (transaction: Transaction) => FirestoreDocumentDataAccessorFactory<T>;
