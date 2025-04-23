import { type FirestoreDocumentDataAccessorFactory } from './accessor';

/**
 * Enumeration of possible contexts for document operations.
 *
 * Used by FirestoreDocumentContext to indicate the execution environment of document operations,
 * which affects how reads and writes are processed (e.g., atomicity, consistency).
 *
 * @remarks
 * - NONE: Standard individual operations without transaction or batch guarantees
 * - TRANSACTION: Operations within a Firestore transaction (atomic, with reads and writes)
 * - BATCH: Operations within a Firestore write batch (atomic writes only, no reads)
 */
export enum FirestoreDocumentContextType {
  /** Standard context with no special transactional semantics */
  NONE = 'none',
  /** Operations within a Firestore transaction (atomic reads and writes) */
  TRANSACTION = 'transaction',
  /** Operations within a Firestore write batch (atomic writes only) */
  BATCH = 'batch'
}

/**
 * Container for document operations within a specific execution context.
 *
 * Provides an accessor factory that creates document accessors appropriate for the current
 * context (standard, transaction, or batch). When operations are performed using accessors
 * from this context, they inherit the guarantees of the context type (e.g., transaction atomicity).
 *
 * This interface is used throughout the accessor system to propagate context information
 * through the document access chain, ensuring consistent behavior.
 *
 * @template T - The document data type that accessors will work with
 */
export interface FirestoreDocumentContext<T> {
  /**
   * The type of execution context (none, transaction, or batch).
   *
   * Determines how operations will be executed and what guarantees they provide.
   */
  readonly contextType: FirestoreDocumentContextType;

  /**
   * Factory for creating document accessors appropriate for this context.
   *
   * The returned accessors will execute operations in a manner consistent with
   * the current context type (e.g., using transaction references for transactions).
   */
  readonly accessorFactory: FirestoreDocumentDataAccessorFactory<T>;
}
