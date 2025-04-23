import { type FirestoreDocumentContext, type FirestoreDocumentContextType } from './context';

/**
 * Factory function type for creating default (non-transactional) document contexts.
 *
 * This factory creates contexts with the standard execution semantics where
 * operations are executed individually without transaction or batch guarantees.
 *
 * @template T - The document data type that accessors from this context will work with
 * @returns A FirestoreDocumentContext with standard execution semantics
 */
export type DefaultFirestoreDocumentContextFactory = <T>() => FirestoreDocumentContext<T>;

/**
 * The standard document context with no special transactional semantics.
 *
 * This context is used for regular document operations outside of transactions or batches.
 * Operations performed through accessors from this context will be executed individually
 * with standard Firestore guarantees but no atomicity across multiple operations.
 *
 * @template T - The document data type that accessors from this context will work with
 */
export interface DefaultFirestoreDocumentContext<T> extends FirestoreDocumentContext<T> {
  /**
   * The context type is always NONE, indicating standard non-transactional execution.
   */
  readonly contextType: FirestoreDocumentContextType.NONE;
}
