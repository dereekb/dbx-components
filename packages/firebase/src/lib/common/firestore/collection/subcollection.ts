import { type FirestoreDocument } from '../accessor/document';
import { type FirestoreCollection, type FirestoreCollectionConfig, makeFirestoreCollection } from './collection';

// MARK: Subcollection
/**
 * Used for collections that are a subcollection of a document.
 */
export interface FirestoreCollectionWithParentConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollectionConfig<T, D> {
  /**
   * The parent document.
   */
  readonly parent: PD;
}

/**
 * A FirestoreCollection as a reference to a Subcollection.
 */
export interface FirestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollection<T, D> {
  readonly parent: PD;
}

/**
 * A FirestoreCollectionWithParent factory type.
 */
export type FirestoreCollectionWithParentFactory<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>, C extends FirestoreCollectionWithParent<T, PT, D, PD> = FirestoreCollectionWithParent<T, PT, D, PD>> = (parent: PD) => C;

/**
 * Creates a new FirestoreCollectionWithParent from the input config.
 */
export function makeFirestoreCollectionWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: FirestoreCollectionWithParentConfig<T, PT, D, PD>): FirestoreCollectionWithParent<T, PT, D, PD> {
  const result = makeFirestoreCollection(config) as FirestoreCollection<T, D> & { parent: PD };
  result.parent = config.parent;
  // todo: consider throwing an exception if parent is not provided.
  return result;
}
