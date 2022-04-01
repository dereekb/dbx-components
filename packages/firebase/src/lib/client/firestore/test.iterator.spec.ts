import { DocumentSnapshot, DocumentReference, runTransaction, Transaction, Firestore, writeBatch } from '@firebase/firestore';
import { MockItem, testItemCollectionReference, MockItemDocument, MockItemFirestoreCollection, testItemFirestoreCollection, authorizedTestWithMockItemCollection } from "../../../test";
import { FirestoreDocumentContext, makeFirestoreCollection } from "../../common/firestore";
import { transactionDocumentContext } from './driver.accessor.transaction';
import { Maybe } from '@dereekb/util';
import { firestoreClientDrivers } from './driver';
import { writeBatchDocumentContext } from './driver.accessor.batch';

describe('Firestore', () => {

  authorizedTestWithMockItemCollection((f) => {


  });

});
