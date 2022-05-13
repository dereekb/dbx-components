import { FirestoreDocument } from './accessor/document';
import { makeFirestoreCollection, FirestoreCollection, FirestoreCollectionConfig, FirestoreCollectionWithParent, FirestoreCollectionWithParentConfig, makeFirestoreCollectionWithParent, SingleItemFirestoreCollection, makeSingleItemFirestoreCollection, SingleItemFirestoreCollectionConfig } from "./collection";
import { FirestoreDrivers } from './driver/driver';
import { WriteBatchFactoryReference, RunTransactionFactoryReference } from './driver';
import { DocumentReference, CollectionReference, DocumentData, Firestore } from "./types";

/**
 * A @dereekb/firestore FirestoreContext. Wraps the main Firestore context and the drivers, as well as utility/convenience functions.
 */
export interface FirestoreContext<F extends Firestore = Firestore> extends RunTransactionFactoryReference, WriteBatchFactoryReference {
  readonly firestore: F;
  readonly drivers: FirestoreDrivers;
  collection<T = DocumentData>(path: string, ...pathSegments: string[]): CollectionReference<T>;
  subcollection<T = DocumentData>(parent: DocumentReference, path: string, ...pathSegments: string[]): CollectionReference<T>;
  firestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionConfig<T, D>): FirestoreCollection<T, D>;
  firestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreContextFirestoreCollectionWithParentConfig<T, PT, D, PD>): FirestoreCollectionWithParent<T, PT, D, PD>;
  singleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreContextSingleItemFirestoreCollectionConfig<T, PT, D, PD>): SingleItemFirestoreCollection<T, PT, D, PD>;
}

export interface FirestoreContextFirestoreCollectionConfig<T, D extends FirestoreDocument<T>> extends Omit<FirestoreCollectionConfig<T, D>, 'driverIdentifier' | 'driverType' | 'firestoreQueryDriver' | 'firestoreAccessorDriver'> { }
export interface FirestoreContextFirestoreCollectionWithParentConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreContextFirestoreCollectionConfig<T, D> {
  readonly parent: PD;
}
export interface FirestoreContextSingleItemFirestoreCollectionConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreContextFirestoreCollectionWithParentConfig<T, PT, D, PD> {
  readonly singleItemIdentifier: string;
}

/**
 * Factory function for generating a FirestoreContext given the input Firestore.
 */
export type FirestoreContextFactory<F extends Firestore = Firestore> = (firestore: F) => FirestoreContext;

/**
 * Creates a new FirestoreContextFactory given the input FirestoreDrivers.
 * 
 * @param drivers 
 * @returns 
 */
export function firestoreContextFactory<F extends Firestore = Firestore>(drivers: FirestoreDrivers): FirestoreContextFactory<F> {
  return (firestore: F) => {
    const makeFirestoreCollectionConfig = <T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionConfig<T, D> | FirestoreContextFirestoreCollectionWithParentConfig<T, any, D, any> | FirestoreContextSingleItemFirestoreCollectionConfig<T, any, D, any>) => ({
      ...config,
      firestoreContext: context,
      driverIdentifier: drivers.driverIdentifier,
      driverType: drivers.driverType,
      firestoreQueryDriver: drivers.firestoreQueryDriver,
      firestoreAccessorDriver: drivers.firestoreAccessorDriver
    });

    const firestoreCollection = <T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionConfig<T, D>) => makeFirestoreCollection(makeFirestoreCollectionConfig(config));

    const context: FirestoreContext<F> = {
      firestore,
      drivers,
      collection: (path: string, ...pathSegments: string[]) => drivers.firestoreAccessorDriver.collection(firestore, path, ...pathSegments),
      subcollection: drivers.firestoreAccessorDriver.subcollection,
      runTransaction: drivers.firestoreAccessorDriver.transactionFactoryForFirestore(firestore),
      batch: drivers.firestoreAccessorDriver.writeBatchFactoryForFirestore(firestore),
      firestoreCollection,
      firestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(inputConfig: FirestoreCollectionWithParentConfig<T, PT, D, PD>): FirestoreCollectionWithParent<T, PT, D, PD> {
        const config: FirestoreCollectionWithParentConfig<T, PT, D, PD> = makeFirestoreCollectionConfig(inputConfig) as FirestoreCollectionWithParentConfig<T, PT, D, PD>;
        return makeFirestoreCollectionWithParent(config);
      },
      singleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(inputConfig: FirestoreContextSingleItemFirestoreCollectionConfig<T, PT, D, PD>): SingleItemFirestoreCollection<T, PT, D, PD> {
        const config: SingleItemFirestoreCollectionConfig<T, PT, D, PD> = makeFirestoreCollectionConfig(inputConfig) as SingleItemFirestoreCollectionConfig<T, PT, D, PD>;
        return makeSingleItemFirestoreCollection(config);
      }
    };

    return context;
  };
}
