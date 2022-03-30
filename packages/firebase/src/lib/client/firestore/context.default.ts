import { defaultFirestoreAccessorFactory } from "./accessor.default";
import { FirestoreDocumentContext, FirestoreDocumentContextType } from "../../common/firestore";

export function defaultFirestoreDocumentContext<T>(): FirestoreDocumentContext<T> {
  return {
    contextType: FirestoreDocumentContextType.NONE,
    accessorFactory: defaultFirestoreAccessorFactory<T>()
  }
}
