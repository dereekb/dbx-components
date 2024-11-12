import { Inject, Injectable, Optional } from '@angular/core';
import { Observable, shareReplay, distinctUntilChanged, map, switchMap, combineLatest, Subscription, of } from 'rxjs';
import {
  DocumentSnapshot,
  DocumentReference,
  FirestoreCollection,
  FirestoreDocument,
  DocumentDataWithIdAndKey,
  FirestoreModelId,
  FirestoreModelKey,
  FirestoreCollectionLike,
  FirestoreModelIdentity,
  firestoreModelIdsFromKey,
  firestoreModelKeyPartPairs,
  FirestoreModelCollectionAndIdPair,
  firestoreModelKeyPairObject,
  FirestoreModelCollectionAndIdPairObject,
  documentDataWithIdAndKey,
  FirestoreAccessorStreamMode,
  TwoWayFlatFirestoreModelKey,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  RootSingleItemFirestoreCollection,
  FlatFirestoreModelKey,
  flatFirestoreModelKey,
  twoWayFlatFirestoreModelKey
} from '@dereekb/firebase';
import { filterMaybe, LoadingState, beginLoading, successResult, loadingStateFromObs, errorResult, ObservableOrValue, isLoadingStateLoading } from '@dereekb/rxjs';
import { Maybe, isMaybeSo } from '@dereekb/util';
import { LockSetComponent, LockSetComponentStore } from '@dereekb/dbx-core';
import { modelDoesNotExistError } from '../../error';

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

@Injectable()
export class AbstractDbxFirebaseDocumentStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, C extends DbxFirebaseDocumentStoreContextState<T, D> = DbxFirebaseDocumentStoreContextState<T, D>> extends LockSetComponentStore<C> implements DbxFirebaseDocumentStore<T, D> {
  // MARK: Effects

  // MARK: Accessors
  readonly currentFirestoreCollectionLike$: Observable<Maybe<FirestoreCollectionLike<T, D>>> = this.state$.pipe(
    map((x) => x.firestoreCollection ?? x.firestoreCollectionLike),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentFirestoreCollection$: Observable<Maybe<FirestoreCollection<T, D>>> = this.state$.pipe(
    map((x) => x.firestoreCollection),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly firestoreCollectionLike$: Observable<FirestoreCollectionLike<T, D>> = this.currentFirestoreCollectionLike$.pipe(filterMaybe());
  readonly firestoreCollection$: Observable<FirestoreCollection<T, D>> = this.currentFirestoreCollection$.pipe(filterMaybe());

  readonly currentInputId$: Observable<Maybe<FirestoreModelId>> = this.state$.pipe(
    map((x) => x.id),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly inputId$: Observable<FirestoreModelId> = this.currentInputId$.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  readonly currentInputKey$: Observable<Maybe<FirestoreModelKey>> = this.state$.pipe(
    map((x) => x.key),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly inputKey$: Observable<FirestoreModelKey> = this.currentInputKey$.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  readonly currentInputRef$: Observable<Maybe<DocumentReference<T>>> = this.state$.pipe(
    map((x) => x.ref),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly inputRef$: Observable<DocumentReference<T>> = this.currentInputRef$.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  readonly streamMode$: Observable<FirestoreAccessorStreamMode> = this.state$.pipe(
    map((x) => x.streamMode ?? FirestoreAccessorStreamMode.STREAM),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentDocument$: Observable<Maybe<D>> = combineLatest([this.currentInputId$, this.currentInputKey$, this.currentInputRef$]).pipe(
    switchMap(([id, key, ref]) => {
      let document: Observable<Maybe<D>>;

      if (ref) {
        document = this.firestoreCollectionLike$.pipe(map((x) => x.documentAccessor().loadDocument(ref)));
      } else if (key) {
        document = this.firestoreCollectionLike$.pipe(map((x) => x.documentAccessor().loadDocumentForKey(key)));
      } else if (id) {
        document = this.firestoreCollection$.pipe(map((x) => x.documentAccessor().loadDocumentForId(id)));
      } else {
        document = of(undefined);
      }

      return document;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Whether or not an id/ref/key has been input and currentDocument is not null.
   */
  readonly hasRef$: Observable<boolean> = this.currentDocument$.pipe(
    map((x) => x?.documentRef != null),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly document$: Observable<D> = this.currentDocument$.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  readonly documentLoadingState$: Observable<LoadingState<D>> = this.currentDocument$.pipe(
    map((x) => (x ? successResult(x) : beginLoading<D>())),
    shareReplay(1)
  );

  readonly id$: Observable<FirestoreModelId> = this.document$.pipe(
    map((x) => x.id),
    shareReplay(1)
  );

  readonly key$: Observable<FirestoreModelKey> = this.document$.pipe(
    map((x) => x.key),
    shareReplay(1)
  );

  readonly keyModelIds$: Observable<FirestoreModelId[]> = this.key$.pipe(map(firestoreModelIdsFromKey), shareReplay(1));
  readonly keyPairs$: Observable<FirestoreModelCollectionAndIdPair[]> = this.key$.pipe(map(firestoreModelKeyPartPairs), filterMaybe(), shareReplay(1));
  readonly keyPairObject$: Observable<FirestoreModelCollectionAndIdPairObject> = this.key$.pipe(map(firestoreModelKeyPairObject), filterMaybe(), shareReplay(1));

  readonly ref$: Observable<DocumentReference<T>> = this.document$.pipe(
    map((x) => x.documentRef),
    shareReplay(1)
  );

  readonly flatKey$: Observable<FlatFirestoreModelKey> = this.key$.pipe(
    map((x) => flatFirestoreModelKey(x)),
    shareReplay(1)
  );

  readonly twoWayFlatKey$: Observable<FlatFirestoreModelKey> = this.key$.pipe(
    map((x) => twoWayFlatFirestoreModelKey(x)),
    shareReplay(1)
  );

  readonly snapshot$: Observable<DocumentSnapshot<T>> = combineLatest([this.document$, this.streamMode$]).pipe(
    switchMap(([x, mode]) => x.snapshotStream(mode)),
    shareReplay(1)
  );

  readonly snapshotLoadingState$: Observable<LoadingState<DocumentSnapshot<T>>> = this.currentDocument$.pipe(
    switchMap(() => loadingStateFromObs(this.snapshot$)),
    shareReplay(1)
  );

  readonly currentData$: Observable<Maybe<DocumentDataWithIdAndKey<T>>> = this.snapshot$.pipe(
    map((x) => documentDataWithIdAndKey(x)),
    shareReplay(1)
  );

  readonly data$: Observable<DocumentDataWithIdAndKey<T>> = this.currentDocument$.pipe(
    switchMap(() => this.currentData$.pipe(filterMaybe())),
    shareReplay(1)
  );

  readonly dataLoadingState$: Observable<LoadingState<DocumentDataWithIdAndKey<T>>> = this.snapshotLoadingState$.pipe(
    map((x) => {
      let result: LoadingState<DocumentDataWithIdAndKey<T>>;

      if (x.value) {
        const data = documentDataWithIdAndKey(x.value);

        if (data) {
          result = successResult(data);
        } else {
          result = errorResult(modelDoesNotExistError());
        }
      } else {
        result = {
          ...x,
          value: undefined
        };
      }

      return result;
    }),
    shareReplay(1)
  );

  readonly isLoadingData$ = this.dataLoadingState$.pipe(map(isLoadingStateLoading), distinctUntilChanged(), shareReplay(1));

  /**
   * Returns false while hasRef$ is false, and then returns exists$.
   */
  readonly currentExists$: Observable<boolean> = this.hasRef$.pipe(
    switchMap((hasRef) => {
      if (hasRef) {
        return this.exists$;
      } else {
        return of(false);
      }
    }),
    shareReplay(1)
  );

  readonly exists$: Observable<boolean> = this.currentData$.pipe(
    map((x) => isMaybeSo(x)),
    shareReplay(1)
  );

  readonly doesNotExist$: Observable<boolean> = this.exists$.pipe(
    map((x) => !x),
    shareReplay(1)
  );

  readonly modelIdentity$: Observable<FirestoreModelIdentity> = this.document$.pipe(
    map((x) => x.modelIdentity),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly setId = this.updater((state, id: Maybe<FirestoreModelId>) => (id ? { ...state, id, key: undefined, ref: undefined } : { ...state, id })) as (observableOrValue: Maybe<string> | Observable<Maybe<string>>) => Subscription;
  readonly setKey = this.updater((state, key: Maybe<FirestoreModelKey>) => (key ? { ...state, key, id: undefined, ref: undefined } : { ...state, key })) as (observableOrValue: Maybe<string> | Observable<Maybe<string>>) => Subscription;
  readonly setFlatKey = this.updater((state, key: Maybe<TwoWayFlatFirestoreModelKey>) => (key ? { ...state, key: inferKeyFromTwoWayFlatFirestoreModelKey(key), id: undefined, ref: undefined } : { ...state, key })) as (observableOrValue: Maybe<string> | Observable<Maybe<string>>) => Subscription;
  readonly setRef = this.updater((state, ref: Maybe<DocumentReference<T>>) => (ref ? { ...state, key: undefined, id: undefined, ref } : { ...state, ref })) as (observableOrValue: Maybe<DocumentReference<T>> | Observable<Maybe<DocumentReference<T>>>) => Subscription;

  readonly setStreamMode = this.updater((state, streamMode: FirestoreAccessorStreamMode) => ({ ...state, streamMode }));

  readonly clearRefs = this.updater((state) => ({ ...state, id: undefined, key: undefined, ref: undefined }));

  readonly setFirestoreCollection = this.updater((state, firestoreCollection: Maybe<FirestoreCollection<T, D>>) => ({ ...state, firestoreCollection }));
  readonly setFirestoreCollectionLike = this.updater((state, firestoreCollectionLike: Maybe<FirestoreCollectionLike<T, D>>) => ({ ...state, firestoreCollectionLike }));
}

function injectSingleItemIdIntoState<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, C extends DbxFirebaseDocumentStoreContextState<T, D> = DbxFirebaseDocumentStoreContextState<T, D>>(state?: C | undefined): C | undefined {
  const id = (state?.firestoreCollection as RootSingleItemFirestoreCollection<T, D>)?.singleItemIdentifier;

  if (state && id != null) {
    return { ...state, id };
  } else {
    return state;
  }
}

/**
 * AbstractDbxFirebaseDocumentWithParentStore extension for use with RootSingleItemFirestoreCollection.
 */
export class AbstractRootSingleItemDbxFirebaseDocument<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, C extends DbxFirebaseDocumentStoreContextState<T, D> = DbxFirebaseDocumentStoreContextState<T, D>> extends AbstractDbxFirebaseDocumentStore<T, D, C> {
  protected constructor(@Inject(null) @Optional() initialState?: C) {
    super(injectSingleItemIdIntoState<T, D, C>(initialState));
  }

  /**
   * Sets the SingleItemFirestoreCollection to use.
   */
  override readonly setFirestoreCollection = this.updater((state, firestoreCollection: Maybe<FirestoreCollection<T, D>>) => {
    if (firestoreCollection != null) {
      const id = (firestoreCollection as RootSingleItemFirestoreCollection<T, D>).singleItemIdentifier;

      if (id != null) {
        return { ...state, firestoreCollection, id };
      } else {
        throw new Error('AbstractRootSingleItemDbxFirebaseDocument only accepts RootSingleItemFirestoreCollection values with a singleItemIdentifier set for setFirestoreCollection.');
      }
    } else {
      return { ...state, firestoreCollection: null };
    }
  });

  /**
   * Does nothing on a AbstractRootSingleItemDbxFirebaseDocument.
   *
   * Ref is set with the FirestoreCollection
   */
  override readonly setId = this.updater((state, id: Maybe<FirestoreModelId>) => state) as (observableOrValue: Maybe<string> | Observable<Maybe<string>>) => Subscription;

  /**
   * Does nothing on a AbstractRootSingleItemDbxFirebaseDocument.
   *
   * Ref is set with the FirestoreCollection
   */
  override readonly setKey = this.updater((state, key: Maybe<FirestoreModelKey>) => state) as (observableOrValue: Maybe<string> | Observable<Maybe<string>>) => Subscription;

  /**
   * Does nothing on a AbstractRootSingleItemDbxFirebaseDocument.
   *
   * Ref is set with the FirestoreCollection
   */
  override readonly setRef = this.updater((state, ref: Maybe<DocumentReference<T>>) => state) as (observableOrValue: Maybe<DocumentReference<T>> | Observable<Maybe<DocumentReference<T>>>) => Subscription;

  override readonly clearRefs = this.updater((state) => state);
}
