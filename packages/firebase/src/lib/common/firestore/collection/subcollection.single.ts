/**
 * @module Firestore Single Document Subcollections
 *
 * This module provides utilities for working with subcollections that focus on a single document
 * within a parent document. This pattern combines the hierarchical structure of subcollections
 * with the focused access provided by single document collections.
 *
 * Single document subcollections are useful for cases where a parent document has a specific,
 * known child document that should be accessed directly, such as:
 * - Configuration or settings for a parent entity
 * - Profile information associated with a user document
 * - Metadata records that are always present for every parent
 * - Default state that exists for every instance of a parent
 *
 * For example, a user document might have a single 'preferences' document in a 'preferences'
 * subcollection, or an organization might have a single 'settings' document in a 'settings'
 * subcollection.
 */
import { build } from '@dereekb/util';
import { extendFirestoreCollectionWithSingleDocumentAccessor, type FirestoreDocument, type FirestoreSingleDocumentAccessor, type SingleItemFirestoreCollectionDocumentIdentifierRef } from '../accessor/document';
import { type FirestoreCollectionWithParent, type FirestoreCollectionWithParentConfig, makeFirestoreCollectionWithParent } from './subcollection';

// MARK: Single-Item Subcollection
/**
 * Configuration for a subcollection that focuses on a single document within a parent document.
 *
 * This configuration extends FirestoreCollectionWithParentConfig with an optional
 * specification for a single document identifier. It combines the hierarchical relationship
 * of subcollections with the focused access of single document collections.
 *
 * @template T - The data type of the subcollection document
 * @template PT - The data type of the parent document
 * @template D - The document type for the subcollection document, defaults to FirestoreDocument<T>
 * @template PD - The document type for the parent document, defaults to FirestoreDocument<PT>
 */
export interface SingleItemFirestoreCollectionConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollectionWithParentConfig<T, PT, D, PD>, Partial<SingleItemFirestoreCollectionDocumentIdentifierRef> {}

/**
 * A subcollection that provides specialized accessors for working with a single document
 * within a parent document context.
 *
 * This interface combines the capabilities of FirestoreCollectionWithParent (which maintains
 * the parent-child relationship) with FirestoreSingleDocumentAccessor (which provides
 * convenient methods for working with a specific document). This allows for direct access
 * to a known document within the subcollection without needing to specify its ID in each call.
 *
 * @template T - The data type of the subcollection document
 * @template PT - The data type of the parent document
 * @template D - The document type for the subcollection document, defaults to FirestoreDocument<T>
 * @template PD - The document type for the parent document, defaults to FirestoreDocument<PT>
 */
export interface SingleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollectionWithParent<T, PT, D, PD>, FirestoreSingleDocumentAccessor<T, D> {}

/**
 * Creates a subcollection that focuses on a single document within a parent document context.
 *
 * This factory function creates a subcollection with specialized accessors for working with
 * a specific document. It combines the hierarchical relationship of parent-child documents
 * with the convenience of direct access to a single, known document in the subcollection.
 *
 * @template T - The data type of the subcollection document
 * @template PT - The data type of the parent document
 * @template D - The document type for the subcollection document, defaults to FirestoreDocument<T>
 * @template PD - The document type for the parent document, defaults to FirestoreDocument<PT>
 * @param config - Configuration for the single document subcollection
 * @returns A subcollection instance with specialized accessors for the single document
 */
export function makeSingleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: SingleItemFirestoreCollectionConfig<T, PT, D, PD>): SingleItemFirestoreCollection<T, PT, D, PD> {
  const collection = build<SingleItemFirestoreCollection<T, PT, D, PD>>({
    base: makeFirestoreCollectionWithParent(config),
    build: (x) => {
      // Extend the collection with single document accessor capabilities
      extendFirestoreCollectionWithSingleDocumentAccessor<SingleItemFirestoreCollection<T, PT, D, PD>, T, D>(x, config.singleItemIdentifier);
    }
  });

  return collection;
}
