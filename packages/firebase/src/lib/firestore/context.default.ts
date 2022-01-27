import { defaultFirestoreAccessorFactory } from "./accessor.default";
import { FirestoreDocumentDatabaseContext, FirestoreDocumentDatabaseContextType } from "./context";

export function defaultFirestoreDatabaseContext<T>(): FirestoreDocumentDatabaseContext<T> {
  return {
    contextType: FirestoreDocumentDatabaseContextType.NONE,
    accessorFactory: defaultFirestoreAccessorFactory<T>()
  }
}
