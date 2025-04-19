import { type FirestoreDocument, type SingleItemFirestoreCollectionDocumentIdentifierRef } from './accessor/document';
import {
  makeFirestoreCollection,
  type FirestoreCollection,
  type FirestoreCollectionConfig,
  type FirestoreCollectionWithParent,
  type FirestoreCollectionWithParentConfig,
  makeFirestoreCollectionWithParent,
  type SingleItemFirestoreCollection,
  makeSingleItemFirestoreCollection,
  type SingleItemFirestoreCollectionConfig,
  type FirestoreCollectionGroup,
  makeFirestoreCollectionGroup,
  type RootSingleItemFirestoreCollectionConfig,
  makeRootSingleItemFirestoreCollection,
  type RootSingleItemFirestoreCollection
} from './collection';
import { type FirestoreDrivers } from './driver/driver';
import { type WriteBatchFactoryReference, type RunTransactionFactoryReference } from './driver';
import { type DocumentReference, type CollectionReference, type DocumentData, type Firestore, type CollectionGroup } from './types';
import { type QueryLikeReferenceRef } from './reference';

/**
 * A high-level context for Firestore operations that wraps the Firestore instance and its drivers.
 *
 * This context provides a unified interface for working with Firestore, offering convenience methods
 * for accessing collections, creating documents, and managing transactions and batches. It serves as
 * the main entry point for Firestore operations throughout the application.
 *
 * The context abstracts away the low-level Firestore implementation details, offering type-safe
 * methods for creating various collection types (standard, group, with parent, single-item) and
 * managing document operations within different execution contexts (standard, transaction, batch).
 *
 * @template F - The Firestore implementation type (defaults to standard Firestore)
 */
export interface FirestoreContext<F extends Firestore = Firestore> extends RunTransactionFactoryReference, WriteBatchFactoryReference {
  /**
   * The underlying Firestore instance.
   */
  readonly firestore: F;

  /**
   * The Firestore drivers used by this context.
   * Contains implementations for queries, accessories, and other Firestore operations.
   */
  readonly drivers: FirestoreDrivers;

  /**
   * Gets a reference to a collection at the specified path.
   *
   * @template T - The document data type in the collection
   * @param path - The initial path segment
   * @param pathSegments - Additional path segments
   * @returns A reference to the specified collection
   */
  collection<T = DocumentData>(path: string, ...pathSegments: string[]): CollectionReference<T>;

  /**
   * Gets a query for all documents in collections with the specified ID.
   *
   * @template T - The document data type in the collection group
   * @param collectionId - The collection ID to query across all document paths
   * @returns A query across all collections with the given ID
   */
  collectionGroup<T = DocumentData>(collectionId: string): CollectionGroup<T>;

  /**
   * Gets a reference to a subcollection within a document.
   *
   * @template T - The document data type in the subcollection
   * @param parent - The parent document reference
   * @param path - The initial path segment
   * @param pathSegments - Additional path segments
   * @returns A reference to the specified subcollection
   */
  subcollection<T = DocumentData>(parent: DocumentReference, path: string, ...pathSegments: string[]): CollectionReference<T>;

  /**
   * Creates a FirestoreCollection for working with documents in a collection.
   *
   * @template T - The document data type
   * @template D - The FirestoreDocument implementation type
   * @param config - Configuration for the collection
   * @returns A FirestoreCollection instance for the specified collection
   */
  firestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionConfig<T, D>): FirestoreCollection<T, D>;

  /**
   * Creates a RootSingleItemFirestoreCollection for working with a single document in a collection.
   *
   * @template T - The document data type
   * @template D - The FirestoreDocument implementation type
   * @param config - Configuration for the collection
   * @returns A RootSingleItemFirestoreCollection instance
   */
  rootSingleItemFirestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionConfig<T, D>): RootSingleItemFirestoreCollection<T, D>;

  /**
   * Creates a FirestoreCollectionGroup for working with documents across collections with the same ID.
   *
   * @template T - The document data type
   * @template D - The FirestoreDocument implementation type
   * @param config - Configuration for the collection group
   * @returns A FirestoreCollectionGroup instance for the specified collection ID
   */
  firestoreCollectionGroup<T, D extends FirestoreDocument<T>>(config: FirestoreContextFirestoreCollectionGroupConfig<T, D>): FirestoreCollectionGroup<T, D>;

  /**
   * Creates a FirestoreCollectionWithParent for working with documents in a subcollection.
   *
   * @template T - The document data type
   * @template PT - The parent document data type
   * @template D - The FirestoreDocument implementation type
   * @template PD - The parent FirestoreDocument implementation type
   * @param config - Configuration for the collection with parent
   * @returns A FirestoreCollectionWithParent instance for the specified subcollection
   */
  firestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreContextFirestoreCollectionWithParentConfig<T, PT, D, PD>): FirestoreCollectionWithParent<T, PT, D, PD>;

  /**
   * Creates a SingleItemFirestoreCollection for working with a single document in a subcollection.
   *
   * @template T - The document data type
   * @template PT - The parent document data type
   * @template D - The FirestoreDocument implementation type
   * @template PD - The parent FirestoreDocument implementation type
   * @param config - Configuration for the single-item collection
   * @returns A SingleItemFirestoreCollection instance for the specified document
   */
  singleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreContextSingleItemFirestoreCollectionConfig<T, PT, D, PD>): SingleItemFirestoreCollection<T, PT, D, PD>;
}

/**
 * Configuration for creating a FirestoreCollection through a FirestoreContext.
 *
 * This type omits driver-related properties from FirestoreCollectionConfig since they will be
 * automatically provided by the FirestoreContext when creating the collection.
 *
 * @template T - The document data type in the collection
 * @template D - The FirestoreDocument implementation type
 */
export type FirestoreContextFirestoreCollectionConfig<T, D extends FirestoreDocument<T>> = Omit<FirestoreCollectionConfig<T, D>, 'firestoreDriverIdentifier' | 'firestoreDriverType' | 'firestoreQueryDriver' | 'firestoreAccessorDriver'>;

/**
 * Configuration for creating a RootSingleItemFirestoreCollection through a FirestoreContext.
 *
 * This configuration extends the standard collection config and optionally allows specifying
 * a custom document identifier for the single item in the collection.
 *
 * @template T - The document data type
 * @template D - The FirestoreDocument implementation type
 */
export interface FirestoreContextRootSingleItemFirestoreCollectionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreContextFirestoreCollectionConfig<T, D>, Partial<SingleItemFirestoreCollectionDocumentIdentifierRef> {}

/**
 * Configuration for creating a FirestoreCollectionGroup through a FirestoreContext.
 *
 * Unlike standard collection configurations, collection group configs use a queryLike reference
 * instead of a collection reference since they span multiple collections with the same ID.
 *
 * @template T - The document data type in the collection group
 * @template D - The FirestoreDocument implementation type
 */
export type FirestoreContextFirestoreCollectionGroupConfig<T, D extends FirestoreDocument<T>> = Omit<FirestoreContextFirestoreCollectionConfig<T, D>, 'collection'> & QueryLikeReferenceRef<T>;

/**
 * Configuration for creating a FirestoreCollectionWithParent through a FirestoreContext.
 *
 * This configuration extends the standard collection config but uses a parent document reference
 * instead of a direct collection reference, enabling access to subcollections within documents.
 *
 * @template T - The document data type in the subcollection
 * @template PT - The parent document data type
 * @template D - The FirestoreDocument implementation type for subcollection documents
 * @template PD - The FirestoreDocument implementation type for the parent document
 */
export interface FirestoreContextFirestoreCollectionWithParentConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends Omit<FirestoreContextFirestoreCollectionConfig<T, D>, 'queryLike'> {
  /**
   * The parent document that contains the subcollection.
   */
  readonly parent: PD;
}

/**
 * Configuration for creating a SingleItemFirestoreCollection through a FirestoreContext.
 *
 * This configuration extends the collection with parent config and optionally allows specifying
 * a custom document identifier for the single item in the subcollection.
 *
 * @template T - The document data type in the subcollection
 * @template PT - The parent document data type
 * @template D - The FirestoreDocument implementation type for subcollection documents
 * @template PD - The FirestoreDocument implementation type for the parent document
 */
export interface FirestoreContextSingleItemFirestoreCollectionConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreContextFirestoreCollectionWithParentConfig<T, PT, D, PD>, Partial<SingleItemFirestoreCollectionDocumentIdentifierRef> {}

/**
 * Factory function type for creating FirestoreContext instances.
 *
 * Takes a Firestore instance and returns a fully configured FirestoreContext that wraps
 * the instance and provides additional functionality through the context interface.
 *
 * @template F - The Firestore implementation type
 * @param firestore - The Firestore instance to wrap
 * @returns A FirestoreContext instance for the specified Firestore
 */
export type FirestoreContextFactory<F extends Firestore = Firestore> = (firestore: F) => FirestoreContext;

/**
 * Creates a factory function for generating FirestoreContext instances.
 *
 * This function takes a set of FirestoreDrivers and returns a factory function that can
 * create FirestoreContext instances for specific Firestore instances. The resulting contexts
 * will use the provided drivers for all Firestore operations.
 *
 * @template F - The Firestore implementation type
 * @param drivers - The Firestore drivers to use in created contexts
 * @returns A factory function that creates FirestoreContext instances
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
