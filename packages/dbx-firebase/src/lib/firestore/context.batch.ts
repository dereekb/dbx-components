import { WriteBatch } from "@firebase/firestore";
import { writeBatchAccessorFactory } from "./accessor.batch";
import { FirestoreDocumentDatabaseContext, FirestoreDocumentDatabaseContextType } from "./context";

// MARK: Batch
export class WriteBatchFirestoreDocumentDatabaseContext<T> implements FirestoreDocumentDatabaseContext<T> {

  readonly contextType = FirestoreDocumentDatabaseContextType.TRANSACTION;
  readonly accessorFactory = writeBatchAccessorFactory<T>(this.batch);

  constructor(readonly batch: WriteBatch) { }

}

export function writeBatchDatabaseContext<T>(batch: WriteBatch): WriteBatchFirestoreDocumentDatabaseContext<T> {
  return new WriteBatchFirestoreDocumentDatabaseContext<T>(batch);
}
