import { LockSetComponent } from '@dereekb/dbx-core';
import { FirestoreDocument, FirestoreCollectionLike, FirestoreCollection, FirestoreModelId, FirestoreModelKey, DocumentReference, FirestoreAccessorStreamMode, FlatFirestoreModelKey, TwoWayFlatFirestoreModelKey, FirestoreModelCollectionAndIdPair, FirestoreModelCollectionAndIdPairObject, DocumentSnapshot, DocumentDataWithIdAndKey, FirestoreModelIdentity } from '@dereekb/firebase';
import { LoadingState, ObservableOrValue } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { Observable, Subscription } from 'rxjs';

/**
 * Provides accessors to a single model/document.
 */
export interface DbxFirebaseDocumentStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends LockSetComponent {
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

export interface DbxFirebaseDocumentStoreContextState<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly firestoreCollectionLike?: Maybe<FirestoreCollectionLike<T, D>>;
  readonly firestoreCollection?: Maybe<FirestoreCollection<T, D>>;
  readonly streamMode?: FirestoreAccessorStreamMode;
  readonly id?: Maybe<FirestoreModelId>;
  readonly key?: Maybe<FirestoreModelKey>;
  readonly ref?: Maybe<DocumentReference<T>>;
}
