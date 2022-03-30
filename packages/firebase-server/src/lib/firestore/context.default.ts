import { defaultFirestoreAccessorFactory } from "./accessor.default";
import { FirestoreDocumentContext, FirestoreDocumentContextType } from "./context";

export function defaultFirestoreDocumentContext<T>(): FirestoreDocumentContext<T> {
  return {
    contextType: FirestoreDocumentContextType.NONE,
    accessorFactory: defaultFirestoreAccessorFactory<T>()
  }
}
