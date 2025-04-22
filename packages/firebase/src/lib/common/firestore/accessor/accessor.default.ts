import { type FirestoreDocumentDataAccessorFactory } from './accessor';

/**
 * Factory function type for creating standard document accessor factories.
 *
 * This is a parameterless factory that creates a document accessor factory for standard
 * (non-transactional) operations. The returned factory can then be used to create document
 * accessors for specific document references.
 *
 * Document accessors created through this factory chain will perform operations with
 * standard Firestore semantics - individual operations with no transactional guarantees
 * across multiple operations.
 *
 * @template T - The document data type that accessors will work with
 * @returns A factory for creating standard document accessors
 */
export type DefaultFirestoreAccessorFactory<T> = () => FirestoreDocumentDataAccessorFactory<T>;
