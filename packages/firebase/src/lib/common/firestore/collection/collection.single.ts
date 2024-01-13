import { build } from '@dereekb/util';
import { extendFirestoreCollectionWithSingleDocumentAccessor, type FirestoreDocument, type FirestoreSingleDocumentAccessor, type SingleItemFirestoreCollectionDocumentIdentifierRef } from '../accessor/document';
import { type FirestoreCollection, type FirestoreCollectionConfig, makeFirestoreCollection } from './collection';

// MARK: Root Single-Item Subcollection
export interface RootSingleItemFirestoreCollectionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreCollectionConfig<T, D>, Partial<SingleItemFirestoreCollectionDocumentIdentifierRef> {}

export interface RootSingleItemFirestoreCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreCollection<T, D>, FirestoreSingleDocumentAccessor<T, D> {}

export function makeRootSingleItemFirestoreCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: RootSingleItemFirestoreCollectionConfig<T, D>): RootSingleItemFirestoreCollection<T, D> {
  const collection = build<RootSingleItemFirestoreCollection<T, D>>({
    base: makeFirestoreCollection(config),
    build: (x) => {
      extendFirestoreCollectionWithSingleDocumentAccessor<RootSingleItemFirestoreCollection<T, D>, T, D>(x, config.singleItemIdentifier);
    }
  });

  return collection;
}
