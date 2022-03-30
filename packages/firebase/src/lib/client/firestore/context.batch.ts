import { WriteBatch } from "@firebase/firestore";
import { writeBatchAccessorFactory } from "./accessor.batch";
import { FirestoreDocumentContext, FirestoreDocumentContextType } from "../../common/firestore";

// MARK: Batch
export class WriteBatchFirestoreDocumentContext<T> implements FirestoreDocumentContext<T> {

  readonly contextType = FirestoreDocumentContextType.BATCH;
  readonly accessorFactory = writeBatchAccessorFactory<T>(this.batch);

  constructor(readonly batch: WriteBatch) { }

}

export function writeBatchDocumentContext<T>(batch: WriteBatch): WriteBatchFirestoreDocumentContext<T> {
  return new WriteBatchFirestoreDocumentContext<T>(batch);
}
