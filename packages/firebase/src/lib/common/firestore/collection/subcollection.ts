/**
 * @module Firestore Subcollections
 *
 * This module provides utilities for working with Firestore subcollections - collections that exist
 * within a specific document rather than at the root level. Subcollections enable hierarchical
 * data modeling in Firestore by allowing documents to contain their own collections.
 *
 * Key features of subcollections:
 * - They provide a natural way to model hierarchical relationships
 * - They establish clear ownership boundaries (parent document owns child documents)
 * - They enable more granular security rules (access to child documents can depend on parent)
 * - They support efficient querying within the context of a specific parent
 *
 * Example hierarchy in Firestore paths:
 * - users/{userId} (parent document)
 * - users/{userId}/posts/{postId} (document in subcollection)
 * - users/{userId}/posts/{postId}/comments/{commentId} (nested subcollection)
 */
import { type FirestoreDocument } from '../accessor/document';
import { type FirestoreCollection, type FirestoreCollectionConfig, makeFirestoreCollection } from './collection';

// MARK: Subcollection
/**
 * Configuration for a Firestore subcollection that maintains a reference to its parent document.
 *
 * This configuration extends the standard FirestoreCollectionConfig with a reference to the
 * parent document, establishing a parent-child relationship between documents in different
 * collections. This relationship is used for building proper collection paths and maintaining
 * the document hierarchy.
 *
 * @template T - The data type of documents in the subcollection
 * @template PT - The data type of the parent document
 * @template D - The document type for documents in the subcollection, defaults to FirestoreDocument<T>
 * @template PD - The document type for the parent document, defaults to FirestoreDocument<PT>
 */
export interface FirestoreCollectionWithParentConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollectionConfig<T, D> {
  /**
   * The parent document that contains this subcollection.
   * This reference establishes the hierarchical relationship and is used for path construction
   * and maintaining the document hierarchy context.
   */
  readonly parent: PD;
}

/**
 * A FirestoreCollection that represents a subcollection with a reference to its parent document.
 *
 * This interface extends FirestoreCollection to maintain the parent-child relationship
 * between documents. It allows access to documents within the context of their parent,
 * enabling proper path construction and maintaining the document hierarchy.
 *
 * @template T - The data type of documents in the subcollection
 * @template PT - The data type of the parent document
 * @template D - The document type for documents in the subcollection, defaults to FirestoreDocument<T>
 * @template PD - The document type for the parent document, defaults to FirestoreDocument<PT>
 */
export interface FirestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollection<T, D> {
  /**
   * Reference to the parent document that contains this subcollection.
   * This allows navigation up the document hierarchy and provides context
   * for the subcollection's position in the data model.
   */
  readonly parent: PD;
}

/**
 * A factory function type for creating subcollection instances for a given parent document.
 *
 * This type defines a function that creates a subcollection instance when given a parent document.
 * It's useful for establishing reusable patterns for accessing subcollections across different
 * parent documents of the same type.
 *
 * @template T - The data type of documents in the subcollection
 * @template PT - The data type of the parent document
 * @template D - The document type for documents in the subcollection, defaults to FirestoreDocument<T>
 * @template PD - The document type for the parent document, defaults to FirestoreDocument<PT>
 * @template C - The specific subcollection type to return, defaults to FirestoreCollectionWithParent<T, PT, D, PD>
 */
export type FirestoreCollectionWithParentFactory<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>, C extends FirestoreCollectionWithParent<T, PT, D, PD> = FirestoreCollectionWithParent<T, PT, D, PD>> = (parent: PD) => C;

/**
 * Creates a new subcollection instance with a reference to its parent document.
 *
 * This factory function creates a subcollection that maintains its relationship to a
 * parent document. The subcollection inherits all the capabilities of a standard
 * collection while also providing access to its parent document context.
 *
 * @template T - The data type of documents in the subcollection
 * @template PT - The data type of the parent document
 * @template D - The document type for documents in the subcollection, defaults to FirestoreDocument<T>
 * @template PD - The document type for the parent document, defaults to FirestoreDocument<PT>
 * @param config - Configuration for the subcollection, including the parent document reference
 * @returns A subcollection instance linked to the specified parent document
 */
export function makeFirestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreCollectionWithParentConfig<T, PT, D, PD>): FirestoreCollectionWithParent<T, PT, D, PD> {
  // Create a standard collection first
  const result = makeFirestoreCollection(config) as FirestoreCollection<T, D> & { parent: PD };

  // Add the parent reference to maintain the document hierarchy relationship
  result.parent = config.parent;

  // TODO: consider throwing an exception if parent is not provided.
  return result;
}
