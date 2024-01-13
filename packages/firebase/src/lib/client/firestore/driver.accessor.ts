import { type Firestore as FirebaseFirestore, runTransaction, doc, collection, writeBatch, type Transaction, collectionGroup } from 'firebase/firestore';
import { type FirestoreAccessorDriver } from '../../common/firestore/driver/accessor';
import { type FirestoreAccessorDriverCollectionGroupFunction, type FirestoreAccessorDriverCollectionRefFunction, type FirestoreAccessorDriverDocumentRefFunction, type FirestoreAccessorDriverFullPathDocumentRefFunction, type FirestoreAccessorDriverSubcollectionRefFunction, type TransactionFunction } from '../../common/firestore/driver';
import { writeBatchDocumentContext } from './driver.accessor.batch';
import { defaultFirestoreDocumentContext } from './driver.accessor.default';
import { transactionDocumentContext } from './driver.accessor.transaction';
import { type TransactionFirestoreDocumentContextFactory } from '../../common/firestore/accessor/context.transaction';
import { type WriteBatchFirestoreDocumentContextFactory } from '../../common/firestore/accessor/context.batch';

export function firestoreClientAccessorDriver(): FirestoreAccessorDriver {
  return {
    doc: doc as unknown as FirestoreAccessorDriverDocumentRefFunction,
    docAtPath: doc as unknown as FirestoreAccessorDriverFullPathDocumentRefFunction,
    collectionGroup: collectionGroup as unknown as FirestoreAccessorDriverCollectionGroupFunction,
    collection: collection as unknown as FirestoreAccessorDriverCollectionRefFunction,
    subcollection: collection as unknown as FirestoreAccessorDriverSubcollectionRefFunction,
    transactionFactoryForFirestore:
      (firestore) =>
      async <T>(fn: TransactionFunction<T>) =>
        await runTransaction(firestore as FirebaseFirestore, fn as (transaction: Transaction) => Promise<T>),
    writeBatchFactoryForFirestore: (firestore) => () => writeBatch(firestore as FirebaseFirestore),
    defaultContextFactory: defaultFirestoreDocumentContext,
    transactionContextFactory: transactionDocumentContext as TransactionFirestoreDocumentContextFactory,
    writeBatchContextFactory: writeBatchDocumentContext as unknown as WriteBatchFirestoreDocumentContextFactory
  };
}
