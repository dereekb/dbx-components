import { Firestore, runTransaction } from '@firebase/firestore';
import { doc, collection, writeBatch, Transaction, collectionGroup } from 'firebase/firestore';
import { FirestoreAccessorDriver } from '../../common/firestore/driver/accessor';
import { FirestoreAccessorDriverCollectionGroupFunction, FirestoreAccessorDriverCollectionRefFunction, FirestoreAccessorDriverDocumentRefFunction, FirestoreAccessorDriverSubcollectionRefFunction, TransactionFunction } from '../../common/firestore/driver';
import { writeBatchDocumentContext } from './driver.accessor.batch';
import { defaultFirestoreDocumentContext } from './driver.accessor.default';
import { transactionDocumentContext } from './driver.accessor.transaction';
import { TransactionFirestoreDocumentContextFactory } from '../../common/firestore/accessor/context.transaction';
import { WriteBatchFirestoreDocumentContextFactory } from '../../common/firestore/accessor/context.batch';

export function firestoreClientAccessorDriver(): FirestoreAccessorDriver {
  return {
    doc: doc as unknown as FirestoreAccessorDriverDocumentRefFunction,
    collectionGroup: collectionGroup as unknown as FirestoreAccessorDriverCollectionGroupFunction,
    collection: collection as unknown as FirestoreAccessorDriverCollectionRefFunction,
    subcollection: collection as unknown as FirestoreAccessorDriverSubcollectionRefFunction,
    transactionFactoryForFirestore:
      (firestore) =>
      async <T>(fn: TransactionFunction<T>) =>
        await runTransaction(firestore as Firestore, fn as (transaction: Transaction) => Promise<T>),
    writeBatchFactoryForFirestore: (firestore) => () => writeBatch(firestore as Firestore),
    defaultContextFactory: defaultFirestoreDocumentContext,
    transactionContextFactory: transactionDocumentContext as TransactionFirestoreDocumentContextFactory,
    writeBatchContextFactory: writeBatchDocumentContext as unknown as WriteBatchFirestoreDocumentContextFactory
  };
}
