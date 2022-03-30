import { FirestoreAccessorDriver } from './accessor/driver';
import { FirestoreDocument } from './accessor/document';
import { makeFirestoreCollection, FirestoreCollection, FirestoreDrivers, FirestoreCollectionConfig } from "./firestore";
import { Firestore } from "./types";

export interface FirestoreContext<F extends Firestore = Firestore> extends Pick<FirestoreAccessorDriver, 'collection'> {
  readonly firestore: F;
  readonly drivers: FirestoreDrivers;
  firestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreContextCollectionConfig<T, D>): FirestoreCollection<T, D>;
}

export interface FirestoreContextCollectionConfig<T, D extends FirestoreDocument<T>> extends Omit<FirestoreCollectionConfig<T, D>, 'firestoreQueryDriver' | 'firestoreAccessorDriver'> { }

export type FirestoreContextFactory<F extends Firestore = Firestore> = (firestore: F) => FirestoreContext;

export function firestoreContextFactory<F>(drivers: FirestoreDrivers): FirestoreContextFactory<F> {
  return (firestore: F) => {
    const context: FirestoreContext<F> = {
      firestore,
      drivers,
      collection: drivers.firestoreAccessorDriver.collection,
      firestoreCollection: <T, D extends FirestoreDocument<T>>(config: FirestoreContextCollectionConfig<T, D>) => makeFirestoreCollection({
        ...config,
        firestoreQueryDriver: drivers.firestoreQueryDriver,
        firestoreAccessorDriver: drivers.firestoreAccessorDriver
      })
    };
    return context;
  };
}
