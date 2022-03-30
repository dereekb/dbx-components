import { FirestoreAccessorDriver } from "../../common/firestore/accessor/driver";
import { defaultFirestoreDocumentContext } from "./context.default";

export function firebaseWebClientAccessorDriver(): FirestoreAccessorDriver {
  return {
    doc: () => {

    },
    defaultContextFactory: defaultFirestoreDocumentContext
  }
}
