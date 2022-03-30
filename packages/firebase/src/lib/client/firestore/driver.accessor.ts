import { doc, collection } from "firebase/firestore";
import { FirestoreAccessorDriver } from "../../common/firestore/accessor/driver";
import { writeBatchDocumentContext } from "./context.batch";
import { defaultFirestoreDocumentContext } from "./context.default";
import { transactionDocumentContext } from "./context.transaction";

export function firestoreClientAccessorDriver(): FirestoreAccessorDriver {
  return {
    doc,
    collection,
    defaultContextFactory: defaultFirestoreDocumentContext,
    transactionContextFactory: transactionDocumentContext,
    writeBatchContextFactory: writeBatchDocumentContext
  };
}
