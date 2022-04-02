import { FirestoreDocument } from './accessor/document';
import { makeFirestoreCollection, FirestoreCollection, FirestoreDrivers, FirestoreCollectionConfig } from "./firestore";
import { CollectionReference, DocumentData, Firestore } from "./types";

export interface FirestoreContext<F extends Firestore = Firestore> {
  readonly firestore: F;
  readonly drivers: FirestoreDrivers;
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
      firestoreCollection: <T, D extends FirestoreDocument<T>>(config: FirestoreContextCollectionConfig<T, D>) => makeFirestoreCollection({
        ...config,
        driverIdentifier: drivers.driverIdentifier,
        driverType: drivers.driverType,
        firestoreQueryDriver: drivers.firestoreQueryDriver,
        firestoreAccessorDriver: drivers.firestoreAccessorDriver
      })
    };

    return context;
  };
}
