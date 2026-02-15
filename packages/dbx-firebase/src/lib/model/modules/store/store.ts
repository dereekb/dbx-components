import { type LockSetComponent } from '@dereekb/dbx-core';
import { type FirestoreDocument, type FirestoreCollectionLike, type FirestoreCollection, type FirestoreModelId, type FirestoreModelKey, type DocumentReference, type FirestoreAccessorStreamMode, type FlatFirestoreModelKey, type TwoWayFlatFirestoreModelKey, type FirestoreModelCollectionAndIdPair, type FirestoreModelCollectionAndIdPairObject, type DocumentSnapshot, type DocumentDataWithIdAndKey, type FirestoreModelIdentity } from '@dereekb/firebase';
import { type LoadingState, type ObservableOrValue } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type Observable, type Subscription } from 'rxjs';

/**
 * Provides read-only accessors to a single model/document.
 */
export interface DbxFirebaseDocumentReadOnlyStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  /**
   * String used to identify the store. Typically only for debugging UI purposes.
   */
  readonly storeName$: Observable<Maybe<string>>;

  readonly firestoreCollectionLike$: Observable<FirestoreCollectionLike<T, D>>;
  readonly firestoreCollection$: Observable<FirestoreCollection<T, D>>;

  readonly currentInputId$: Observable<Maybe<FirestoreModelId>>;
  readonly inputId$: Observable<FirestoreModelId>;
  readonly currentInputKey$: Observable<Maybe<FirestoreModelKey>>;
  readonly inputKey$: Observable<FirestoreModelKey>;
  readonly currentInputRef$: Observable<Maybe<DocumentReference<T>>>;
  readonly inputRef$: Observable<DocumentReference<T>>;

  readonly streamMode$: Observable<FirestoreAccessorStreamMode>;

  readonly currentDocument$: Observable<Maybe<D>>;
  readonly document$: Observable<D>;
  readonly currentId$: Observable<Maybe<FirestoreModelId>>;
  readonly currentKey$: Observable<Maybe<FirestoreModelKey>>;
  readonly id$: Observable<FirestoreModelId>;
  readonly key$: Observable<FirestoreModelKey>;
  readonly ref$: Observable<DocumentReference<T>>;
  readonly hasRef$: Observable<boolean>;
  readonly flatKey$: Observable<FlatFirestoreModelKey>;
  readonly twoWayFlatKey$: Observable<TwoWayFlatFirestoreModelKey>;

  readonly keyModelIds$: Observable<FirestoreModelId[]>;
  readonly keyPairs$: Observable<FirestoreModelCollectionAndIdPair[]>;
  readonly keyPairObject$: Observable<FirestoreModelCollectionAndIdPairObject>;

  readonly documentLoadingState$: Observable<LoadingState<D>>;
  readonly snapshot$: Observable<DocumentSnapshot<T>>;
  readonly snapshotLoadingState$: Observable<LoadingState<DocumentSnapshot<T>>>;
  readonly currentData$: Observable<Maybe<DocumentDataWithIdAndKey<T>>>;
  readonly data$: Observable<DocumentDataWithIdAndKey<T>>;
  readonly dataLoadingState$: Observable<LoadingState<DocumentDataWithIdAndKey<T>>>;
  readonly isLoadingData$: Observable<boolean>;
  readonly currentExists$: Observable<boolean>;
  readonly exists$: Observable<boolean>;
  readonly modelIdentity$: Observable<FirestoreModelIdentity>;
}

/**
 * Provides accessors to a single model/document.
 */
export interface DbxFirebaseDocumentStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends DbxFirebaseDocumentReadOnlyStore<T, D>, LockSetComponent {
  /**
   * Sets the name of the store.
   */
  readonly setStoreName: (observableOrValue: ObservableOrValue<Maybe<string>>) => Subscription;

  /**
   * Sets the id of the document to load.
   */
  readonly setId: (observableOrValue: ObservableOrValue<Maybe<FirestoreModelId>>) => Subscription;

  /**
   * Sets the key of the document to load.
   */
  readonly setKey: (observableOrValue: ObservableOrValue<Maybe<FirestoreModelKey>>) => Subscription;

  /**
   * Sets the key of the document to load using a TwoWayFlatFirestoreModelKey.
   */
  readonly setFlatKey: (observableOrValue: ObservableOrValue<Maybe<TwoWayFlatFirestoreModelKey>>) => Subscription;

  /**
   * Sets the ref of the document to load.
   */
  readonly setRef: (observableOrValue: ObservableOrValue<Maybe<DocumentReference<T>>>) => Subscription;

  /**
   * Clears the key/id/ref and current document from the store.
   */
  readonly clearRefs: () => void;

  /**
   * Sets the stream mode.
   */
  readonly setStreamMode: (observableOrValue: ObservableOrValue<FirestoreAccessorStreamMode>) => Subscription;

  /**
   * Sets the FirestoreCollection to retrieve documents from.
   */
  readonly setFirestoreCollection: (() => void) | ((observableOrValue: ObservableOrValue<Maybe<FirestoreCollection<T, D>>>) => Subscription);

  /**
   * Sets the FirestoreCollectionLike to retrieve documents from.
   */
  readonly setFirestoreCollectionLike: (() => void) | ((observableOrValue: ObservableOrValue<Maybe<FirestoreCollectionLike<T, D>>>) => Subscription);
}
