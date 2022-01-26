import { FirestoreDocumentDatabaseAccessorFactory } from "./accessor";

export enum FirestoreDocumentDatabaseContextType {
  NONE = 'none',
  TRANSACTION = 'transaction',
  BATCH = 'batch'
}

/**
 * Firebase database context used for accessing and modifying documents in a specific context, such as a transaction.
 */
export interface FirestoreDocumentDatabaseContext<T> {

  /**
   * Context type
   */
  readonly contextType: FirestoreDocumentDatabaseContextType;

  /**
   * Database accessor
   */
  readonly accessorFactory: FirestoreDocumentDatabaseAccessorFactory<T>;

}
