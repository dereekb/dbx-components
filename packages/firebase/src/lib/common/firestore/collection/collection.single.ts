import { build } from '@dereekb/util';
import { extendFirestoreCollectionWithSingleDocumentAccessor, type FirestoreDocument, type FirestoreSingleDocumentAccessor, type SingleItemFirestoreCollectionDocumentIdentifierRef } from '../accessor/document';
import { type FirestoreCollection, type FirestoreCollectionConfig, makeFirestoreCollection } from './collection';

// MARK: Root Single-Item Subcollection
/**
 * Configuration for creating a root-level collection that focuses on a single document.
 *
 * This configuration extends the standard FirestoreCollectionConfig with optional
 * settings for specifying a single document identifier. This is used when you need
 * to work with a specific document in a collection, such as configuration or settings.
 *
 * @template T - The data type of the document
 * @template D - The FirestoreDocument type, defaults to FirestoreDocument<T>
 */
export interface RootSingleItemFirestoreCollectionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreCollectionConfig<T, D>, Partial<SingleItemFirestoreCollectionDocumentIdentifierRef> {}

/**
 * A Firestore collection that provides specialized accessors for working with a single document.
 *
 * This interface combines the capabilities of a standard FirestoreCollection with
 * FirestoreSingleDocumentAccessor, providing convenient methods for working directly
 * with a single document without needing to specify its ID in each call.
 *
 * @template T - The data type of the document
 * @template D - The FirestoreDocument type, defaults to FirestoreDocument<T>
 */
export interface RootSingleItemFirestoreCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreCollection<T, D>, FirestoreSingleDocumentAccessor<T, D> {}

/**
 * Creates a root-level Firestore collection focused on a single document.
 *
 * This factory function creates a specialized collection that combines standard collection
 * functionality with convenient accessors for working with a single document. It's particularly
 * useful for application settings, configuration, or any singleton-like data structures
 * that are stored in Firestore.
 *
 * @template T - The data type of the document
 * @template D - The FirestoreDocument type, defaults to FirestoreDocument<T>
 * @param config - Configuration for the single document collection
 * @returns A RootSingleItemFirestoreCollection instance configured for the specified document
 */
export function makeRootSingleItemFirestoreCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: RootSingleItemFirestoreCollectionConfig<T, D>): RootSingleItemFirestoreCollection<T, D> {
  const collection = build<RootSingleItemFirestoreCollection<T, D>>({
    base: makeFirestoreCollection(config),
    build: (x) => {
      extendFirestoreCollectionWithSingleDocumentAccessor<RootSingleItemFirestoreCollection<T, D>, T, D>(x, config.singleItemIdentifier);
    }
  });

  return collection;
}
