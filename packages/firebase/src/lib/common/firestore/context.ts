import { FirestoreDocument } from './accessor/document';
import { makeFirestoreCollection, FirestoreCollection, FirestoreDrivers, FirestoreCollectionConfig, FirestoreCollectionWithParent, FirestoreCollectionWithParentConfig, makeFirestoreCollectionWithParent } from "./firestore";
import { WriteBatchFactory, TransactionFactory } from './factory';
import { DocumentReference, CollectionReference, DocumentData, Firestore } from "./types";

export interface FirestoreContext<F extends Firestore = Firestore> extends TransactionFactory, WriteBatchFactory {
  readonly firestore: F;
  readonly drivers: FirestoreDrivers;
  collection<T = DocumentData>(path: string, ...pathSegments: string[]): CollectionReference<T>;
  subCollection<T = DocumentData>(parent: DocumentReference, path: string, ...pathSegments: string[]): CollectionReference<T>;
  firestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreContextCollectionConfig<T, D>): FirestoreCollection<T, D>;
  firestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreContextCollectionWithParentConfig<T, PT, D, PD>): FirestoreCollectionWithParent<T, PT, D, PD>;
}

export interface FirestoreContextCollectionConfig<T, D extends FirestoreDocument<T>> extends Omit<FirestoreCollectionConfig<T, D>, 'driverIdentifier' | 'driverType' | 'firestoreQueryDriver' | 'firestoreAccessorDriver'> { }
export interface FirestoreContextCollectionWithParentConfig<T, PT, D extends FirestoreDocument<T>, PD extends FirestoreDocument<PT>> extends FirestoreContextCollectionConfig<T, D> {
  parent: PD;
}

export type FirestoreContextFactory<F extends Firestore = Firestore> = (firestore: F) => FirestoreContext;

export function firestoreContextFactory<F extends Firestore = Firestore>(drivers: FirestoreDrivers): FirestoreContextFactory<F> {
  return (firestore: F) => {
    const makeFirestoreCollectionConfig = <T, D extends FirestoreDocument<T>>(config: FirestoreContextCollectionConfig<T, D> | FirestoreCollectionWithParentConfig<T, any, D, any>) => ({
      ...config,
      firestoreContext: context,
      driverIdentifier: drivers.driverIdentifier,
      driverType: drivers.driverType,
      firestoreQueryDriver: drivers.firestoreQueryDriver,
      firestoreAccessorDriver: drivers.firestoreAccessorDriver
    });

    const firestoreCollection = <T, D extends FirestoreDocument<T>>(config: FirestoreContextCollectionConfig<T, D>) => makeFirestoreCollection(makeFirestoreCollectionConfig(config));

    const context: FirestoreContext<F> = {
      firestore,
      drivers,
      collection: (path: string, ...pathSegments: string[]) => drivers.firestoreAccessorDriver.collection(firestore, path, ...pathSegments),
      subCollection: drivers.firestoreAccessorDriver.subCollection,
      runTransaction: drivers.firestoreAccessorDriver.transactionFactoryForFirestore(firestore),
      batch: drivers.firestoreAccessorDriver.writeBatchFactoryForFirestore(firestore),
      firestoreCollection,
      firestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(inputConfig: FirestoreCollectionWithParentConfig<T, PT, D, PD>): FirestoreCollectionWithParent<T, PT, D, PD> {
        const config: FirestoreCollectionWithParentConfig<T, PT, D, PD> = makeFirestoreCollectionConfig(inputConfig) as FirestoreCollectionWithParentConfig<T, PT, D, PD>;
        return makeFirestoreCollectionWithParent(config);
      }
    };

    return context;
  };
}
