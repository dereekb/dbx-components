import { type WriteBatch } from '../types';
import { type FirestoreDocumentDataAccessorFactory } from './accessor';

/**
 * Factory function type for creating document accessor factories that operate within a write batch.
 *
 * This is a higher-order factory that takes a Firestore WriteBatch and returns a document
 * accessor factory. All document accessors created by the returned factory will perform
 * their write operations as part of the specified batch, providing atomicity guarantees
 * across multiple documents and operations.
 *
 * @template T - The document data type that accessors will work with
 * @param writeBatch - The Firestore write batch to execute operations within
 * @returns A factory for creating document accessors that operate within the specified write batch
 */
export type WriteBatchAccessorFactory = <T>(writeBatch: WriteBatch) => FirestoreDocumentDataAccessorFactory<T>;
