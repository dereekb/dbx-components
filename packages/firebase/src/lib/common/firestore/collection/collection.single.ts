import { build } from '@dereekb/util';
import { extendFirestoreCollectionWithSingleDocumentAccessor, type FirestoreDocument, type FirestoreSingleDocumentAccessor, type SingleItemFirestoreCollectionDocumentIdentifierRef } from '../accessor/document';
import { type FirestoreCollection, type FirestoreCollectionConfig, makeFirestoreCollection } from './collection';

// MARK: Root Single-Item Collection
/**
 * Configuration for creating a root-level collection that focuses on a single document.
 *
 * Backs the `'root-singleton'` collection kind. This configuration extends
 * the standard FirestoreCollectionConfig with optional settings for
 * specifying a single document identifier — used when you need to work with
 * a specific document in a root collection, such as application
 * configuration or per-deploy settings.
 *
 * @template T - The data type of the document
 * @template D - The FirestoreDocument type, defaults to FirestoreDocument<T>
 */
export interface RootSingleItemFirestoreCollectionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreCollectionConfig<T, D>, Partial<SingleItemFirestoreCollectionDocumentIdentifierRef> {}

/**
 * A Firestore collection that provides specialized accessors for working with a single document.
 *
 * Backs the `'root-singleton'` collection kind: a single document in a root
 * collection, identified up-front by a fixed `singleItemIdentifier`. Created
 * at runtime via `firestoreContext.rootSingleItemFirestoreCollection({...})`
 * and typed at the model layer as
 * `<Model>FirestoreCollection = RootSingleItemFirestoreCollection<T, D>`.
 *
 * For the parent-bound counterpart (one document per parent), see
 * {@link SingleItemFirestoreCollection} (kind `'singleton-sub'`).
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
 * Backing factory for the `'root-singleton'` collection kind. Combines
 * standard collection functionality with convenient accessors for working
 * with a single document. Useful for application settings, configuration,
 * or any singleton-like data structures that are stored in Firestore.
 *
 * @template T - The data type of the document
 * @template D - The FirestoreDocument type, defaults to FirestoreDocument<T>
 * @param config - Configuration for the single document collection
 * @returns A RootSingleItemFirestoreCollection instance configured for the specified document
 */
export function makeRootSingleItemFirestoreCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: RootSingleItemFirestoreCollectionConfig<T, D>): RootSingleItemFirestoreCollection<T, D> {
  return build<RootSingleItemFirestoreCollection<T, D>>({
    base: makeFirestoreCollection(config),
    build: (x) => {
      extendFirestoreCollectionWithSingleDocumentAccessor<RootSingleItemFirestoreCollection<T, D>, T, D>(x, config.singleItemIdentifier);
    }
  });
}
