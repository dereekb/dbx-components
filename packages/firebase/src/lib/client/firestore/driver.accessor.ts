import { doc, collection } from "firebase/firestore";
import { FirestoreAccessorDriver } from "../../common/firestore/accessor/driver";
import { writeBatchDocumentContext } from "./driver.accessor.batch";
import { defaultFirestoreDocumentContext } from "./driver.accessor.default";
import { transactionDocumentContext } from "./driver.accessor.transaction";

export function firestoreClientAccessorDriver(): FirestoreAccessorDriver {
  return {
    doc,
    collection,
    defaultContextFactory: defaultFirestoreDocumentContext,
    transactionContextFactory: transactionDocumentContext,
    writeBatchContextFactory: writeBatchDocumentContext
  };
}
