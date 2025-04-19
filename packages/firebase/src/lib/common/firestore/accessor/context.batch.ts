import { type WriteBatch } from '../types';
import { type FirestoreDocumentContext, type FirestoreDocumentContextType } from './context';

/**
 * Factory function type for creating write batch document contexts.
 *
 * This factory creates contexts that execute write operations within a Firestore batch,
 * providing atomicity guarantees across multiple write operations.
 *
 * @template T - The document data type that accessors from this context will work with
 * @param writeBatch - The Firestore write batch to execute operations within
 * @returns A FirestoreDocumentContext with batch execution semantics
 */
export type WriteBatchFirestoreDocumentContextFactory = <T>(writeBatch: WriteBatch) => WriteBatchFirestoreDocumentContext<T>;

/**
 * Document context for operations executed within a Firestore write batch.
 *
 * This context ensures that document write operations are performed as part of a batch,
 * providing atomicity guarantees. Multiple write operations performed through accessors
 * from this context will either all succeed or all fail together.
 *
 * Unlike transactions, batches in Firestore only support write operations (create, update,
 * delete) and cannot read documents. This makes them more performant for write-only
 * operations that don't depend on reading the current state.
 *
 * @template T - The document data type that accessors from this context will work with
 */
export interface WriteBatchFirestoreDocumentContext<T> extends FirestoreDocumentContext<T> {
  /**
   * The context type is always BATCH, indicating batch execution.
   */
  readonly contextType: FirestoreDocumentContextType.BATCH;

  /**
   * The Firestore write batch that operations will be executed within.
   *
   * All write operations performed through accessors from this context will be part of this batch.
   */
  readonly batch: WriteBatch;
}
