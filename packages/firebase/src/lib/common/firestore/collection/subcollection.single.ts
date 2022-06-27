import { FirestoreDocument, FirestoreSingleDocumentAccessor, firestoreSingleDocumentAccessor } from '../accessor/document';
import { FirestoreCollectionWithParent, FirestoreCollectionWithParentConfig, makeFirestoreCollectionWithParent } from './subcollection';

// MARK: Single-Item Subcollection
export type SingleItemFirestoreCollectionItemIdentifier = string;

export const DEFAULT_SINGLE_ITEM_FIRESTORE_COLLECTION_ITEM_IDENTIFIER = '0';

export interface SingleItemFirestoreCollectionConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollectionWithParentConfig<T, PT, D, PD> {
  /**
   * Identifier of the single item.
   */
  readonly singleItemIdentifier?: SingleItemFirestoreCollectionItemIdentifier;
}

export interface SingleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreSingleDocumentAccessor<T, D> {
  readonly collection: FirestoreCollectionWithParent<T, PT, D, PD>;
}

export function makeSingleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: SingleItemFirestoreCollectionConfig<T, PT, D, PD>): SingleItemFirestoreCollection<T, PT, D, PD> {
  const collection = makeFirestoreCollectionWithParent(config);

  return {
    collection,
    ...firestoreSingleDocumentAccessor({
      accessors: collection,
      singleItemIdentifier: config.singleItemIdentifier || DEFAULT_SINGLE_ITEM_FIRESTORE_COLLECTION_ITEM_IDENTIFIER
    })
  };
}
