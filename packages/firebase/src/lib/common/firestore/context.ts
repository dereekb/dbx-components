import { FirestoreDocument, SingleItemFirestoreCollectionDocumentIdentifierRef } from './accessor/document';
import { makeFirestoreCollection, FirestoreCollection, FirestoreCollectionConfig, FirestoreCollectionWithParent, FirestoreCollectionWithParentConfig, makeFirestoreCollectionWithParent, SingleItemFirestoreCollection, makeSingleItemFirestoreCollection, SingleItemFirestoreCollectionConfig, FirestoreCollectionGroup, makeFirestoreCollectionGroup, RootSingleItemFirestoreCollectionConfig, makeRootSingleItemFirestoreCollection, RootSingleItemFirestoreCollection } from './collection';
import { FirestoreDrivers } from './driver/driver';
import { WriteBatchFactoryReference, RunTransactionFactoryReference } from './driver';
import { DocumentReference, CollectionReference, DocumentData, Firestore, CollectionGroup } from './types';
import { QueryLikeReferenceRef } from './reference';

/**
 * A @dereekb/firebase FirestoreContext. Wraps the main Firestore context and the drivers, as well as utility/convenience functions.
 */
export interface FirestoreContext<F extends Firestore = Firestore> extends RunTransactionFactoryReference, WriteBatchFactoryReference {
  readonly firestore: F;
  readonly drivers: FirestoreDrivers;
  collection<T = DocumentData>(path: string, ...pathSegments: string[]): CollectionReference<T>;
  collectionGroup<T = DocumentData>(collectionId: string): CollectionGroup<T>;
  subcollection<T = DocumentData>(parent: DocumentReference, path: string, ...pathSegments: string[]): CollectionReference<T>;
  firestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionConfig<T, D>): FirestoreCollection<T, D>;
  rootSingleItemFirestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionConfig<T, D>): FirestoreCollection<T, D>;
  firestoreCollectionGroup<T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionGroupConfig<T, D>): FirestoreCollectionGroup<T, D>;
  firestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreContextFirestoreCollectionWithParentConfig<T, PT, D, PD>): FirestoreCollectionWithParent<T, PT, D, PD>;
  singleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreContextSingleItemFirestoreCollectionConfig<T, PT, D, PD>): SingleItemFirestoreCollection<T, PT, D, PD>;
}

export type FirestoreContextFirestoreCollectionConfig<T, D extends FirestoreDocument<T>> = Omit<FirestoreCollectionConfig<T, D>, 'firestoreDriverIdentifier' | 'firestoreDriverType' | 'firestoreQueryDriver' | 'firestoreAccessorDriver'>;

export interface FirestoreContextRootSingleItemFirestoreCollectionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreContextFirestoreCollectionConfig<T, D>, Partial<SingleItemFirestoreCollectionDocumentIdentifierRef> {}

export type FirestoreContextFirestoreCollectionGroupConfig<T, D extends FirestoreDocument<T>> = Omit<FirestoreContextFirestoreCollectionConfig<T, D>, 'collection'> & QueryLikeReferenceRef<T>;

export interface FirestoreContextFirestoreCollectionWithParentConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends Omit<FirestoreContextFirestoreCollectionConfig<T, D>, 'queryLike'> {
  readonly parent: PD;
}

export interface FirestoreContextSingleItemFirestoreCollectionConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreContextFirestoreCollectionWithParentConfig<T, PT, D, PD>, Partial<SingleItemFirestoreCollectionDocumentIdentifierRef> {}

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
    const makeFirestoreCollectionConfig = <T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreContextFirestoreCollectionConfig<T, D> | FirestoreContextFirestoreCollectionGroupConfig<T, D> | FirestoreContextFirestoreCollectionWithParentConfig<T, PT, D, PD> | FirestoreContextSingleItemFirestoreCollectionConfig<T, PT, D, PD>) => {
      const queryLike = (config as FirestoreContextFirestoreCollectionConfig<T, D>).collection ?? (config as FirestoreContextFirestoreCollectionGroupConfig<T, D>).queryLike;

      return {
        ...config,
        collection: config.converter ? (config as FirestoreContextFirestoreCollectionConfig<T, D>).collection?.withConverter(config.converter) : (config as FirestoreContextFirestoreCollectionConfig<T, D>).collection,
        queryLike: config.converter ? queryLike.withConverter(config.converter) : queryLike,
        firestoreContext: context,
        firestoreDriverIdentifier: drivers.firestoreDriverIdentifier,
        firestoreDriverType: drivers.firestoreDriverType,
        firestoreQueryDriver: drivers.firestoreQueryDriver,
        firestoreAccessorDriver: drivers.firestoreAccessorDriver
      };
    };

    const firestoreCollection = <T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionConfig<T, D>) => makeFirestoreCollection(makeFirestoreCollectionConfig(config) as FirestoreCollectionConfig<T, D>);
    const firestoreCollectionGroup = <T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionGroupConfig<T, D>) => makeFirestoreCollectionGroup(makeFirestoreCollectionConfig(config));

    const context: FirestoreContext<F> = {
      firestore,
      drivers,
      collectionGroup: (collectionId: string) => drivers.firestoreAccessorDriver.collectionGroup(firestore, collectionId),
      collection: (path: string, ...pathSegments: string[]) => drivers.firestoreAccessorDriver.collection(firestore, path, ...pathSegments),
      subcollection: drivers.firestoreAccessorDriver.subcollection,
      runTransaction: drivers.firestoreAccessorDriver.transactionFactoryForFirestore(firestore),
      batch: drivers.firestoreAccessorDriver.writeBatchFactoryForFirestore(firestore),
      firestoreCollection,
      rootSingleItemFirestoreCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(inputConfig: FirestoreContextRootSingleItemFirestoreCollectionConfig<T, D>): RootSingleItemFirestoreCollection<T, D> {
        const config: RootSingleItemFirestoreCollectionConfig<T, D> = makeFirestoreCollectionConfig(inputConfig) as RootSingleItemFirestoreCollectionConfig<T, D>;
        return makeRootSingleItemFirestoreCollection(config);
      },
      firestoreCollectionGroup,
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
