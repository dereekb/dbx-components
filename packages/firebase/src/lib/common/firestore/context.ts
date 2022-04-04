import { FirestoreDocument } from './accessor/document';
import { makeFirestoreCollection, FirestoreCollection, FirestoreDrivers, FirestoreCollectionConfig } from "./firestore";
import { RunTransactionFunction, TransactionFactory, WriteBatchFactory } from './factory';
import { CollectionReference, DocumentData, Firestore, WriteBatch } from "./types";

export interface FirestoreContext<F extends Firestore = Firestore> extends TransactionFactory, WriteBatchFactory {
  readonly firestore: F;
  readonly drivers: FirestoreDrivers;
  transaction(): RunTransactionFunction;
  writeBatch(): WriteBatch;
  collection<T = DocumentData>(collectionPath: string): CollectionReference<T>;
  firestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreContextCollectionConfig<T, D>): FirestoreCollection<T, D>;
}

export interface FirestoreContextCollectionConfig<T, D extends FirestoreDocument<T>> extends Omit<FirestoreCollectionConfig<T, D>, 'driverIdentifier' | 'driverType' | 'firestoreQueryDriver' | 'firestoreAccessorDriver'> { }

export type FirestoreContextFactory<F extends Firestore = Firestore> = (firestore: F) => FirestoreContext;

export function firestoreContextFactory<F extends Firestore = Firestore>(drivers: FirestoreDrivers): FirestoreContextFactory<F> {
  return (firestore: F) => {
    const context: FirestoreContext<F> = {
      firestore,
      drivers,
      collection: (collectionPath: string) => drivers.firestoreAccessorDriver.collection(firestore, collectionPath),
      transaction: () => drivers.firestoreAccessorDriver.transaction(firestore),
      writeBatch: () => drivers.firestoreAccessorDriver.writeBatch(firestore),
      firestoreCollection: <T, D extends FirestoreDocument<T>>(config: FirestoreContextCollectionConfig<T, D>) => makeFirestoreCollection({
        ...config,
        firestoreContext: context,
        driverIdentifier: drivers.driverIdentifier,
        driverType: drivers.driverType,
        firestoreQueryDriver: drivers.firestoreQueryDriver,
        firestoreAccessorDriver: drivers.firestoreAccessorDriver
      })
    };

    return context;
  };
}
