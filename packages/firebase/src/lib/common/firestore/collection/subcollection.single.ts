import { build } from '@dereekb/util';
import { extendFirestoreCollectionWithSingleDocumentAccessor, FirestoreDocument, FirestoreSingleDocumentAccessor, SingleItemFirestoreCollectionDocumentIdentifierRef } from '../accessor/document';
import { FirestoreCollectionWithParent, FirestoreCollectionWithParentConfig, makeFirestoreCollectionWithParent } from './subcollection';

// MARK: Single-Item Subcollection
export interface SingleItemFirestoreCollectionConfig<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollectionWithParentConfig<T, PT, D, PD>, Partial<SingleItemFirestoreCollectionDocumentIdentifierRef> {}

export interface SingleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollectionWithParent<T, PT, D, PD>, FirestoreSingleDocumentAccessor<T, D> {}

export function makeSingleItemFirestoreCollection<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: SingleItemFirestoreCollectionConfig<T, PT, D, PD>): SingleItemFirestoreCollection<T, PT, D, PD> {
  const collection = build<SingleItemFirestoreCollection<T, PT, D, PD>>({
    base: makeFirestoreCollectionWithParent(config),
    build: (x) => {
      extendFirestoreCollectionWithSingleDocumentAccessor<SingleItemFirestoreCollection<T, PT, D, PD>, T, D>(x, config.singleItemIdentifier);
    }
  });

  return collection;
}
