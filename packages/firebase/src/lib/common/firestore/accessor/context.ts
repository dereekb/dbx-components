import { FirestoreDocumentDataAccessorFactory } from "./accessor";

/**
 * A specific document context type.
 * 
 * Used by a FirestoreDocumentContext to communicate which kind of context it was created in.
 */
export enum FirestoreDocumentContextType {
  NONE = 'none',
  TRANSACTION = 'transaction',
  BATCH = 'batch'
}

/**
 * Firebase database context used for accessing and modifying documents in a specific context, such as a transaction.
 */
export interface FirestoreDocumentContext<T> {

  /**
   * Context type
   */
  readonly contextType: FirestoreDocumentContextType;

  /**
   * Database accessor
   */
  readonly accessorFactory: FirestoreDocumentDataAccessorFactory<T>;

}
