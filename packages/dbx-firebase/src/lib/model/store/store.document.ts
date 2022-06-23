import { Injectable } from '@angular/core';
import { Observable, shareReplay, distinctUntilChanged, map, switchMap, combineLatest, Subscription, of } from 'rxjs';
import { DocumentSnapshot, DocumentReference, FirestoreCollection, FirestoreDocument, documentDataWithId, DocumentDataWithId, FirestoreModelId, FirestoreModelKey, FirestoreCollectionLike, FirestoreModelIdentity, firestoreModelIdsFromKey, firestoreModelKeyPartPairs, FirestoreModelCollectionAndIdPair, firestoreModelKeyPairObject, FirestoreModelCollectionAndIdPairObject } from '@dereekb/firebase';
import { filterMaybe, LoadingState, beginLoading, successResult, loadingStateFromObs, errorResult, ObservableOrValue } from '@dereekb/rxjs';
import { Maybe, isMaybeSo } from '@dereekb/util';
import { LockSetComponent, LockSetComponentStore } from '@dereekb/dbx-core';
import { modelDoesNotExistError } from '../error';

export interface DbxFirebaseDocumentStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends LockSetComponent {
  readonly firestoreCollectionLike$: Observable<FirestoreCollectionLike<T, D>>;
  readonly firestoreCollection$: Observable<FirestoreCollection<T, D>>;

  readonly currentInputId$: Observable<Maybe<FirestoreModelId>>;
  readonly inputId$: Observable<FirestoreModelId>;
  readonly currentInputKey$: Observable<Maybe<FirestoreModelKey>>;
  readonly inputKey$: Observable<FirestoreModelKey>;
  readonly currentInputRef$: Observable<Maybe<DocumentReference<T>>>;
  readonly inputRef$: Observable<DocumentReference<T>>;

  readonly currentDocument$: Observable<Maybe<D>>;
  readonly document$: Observable<D>;
  readonly id$: Observable<FirestoreModelId>;
  readonly key$: Observable<FirestoreModelKey>;
  readonly ref$: Observable<DocumentReference<T>>;

  readonly keyModelIds$: Observable<FirestoreModelId[]>;
  readonly keyPairs$: Observable<FirestoreModelCollectionAndIdPair[]>;
  readonly keyPairObject$: Observable<FirestoreModelCollectionAndIdPairObject>;

  readonly documentLoadingState$: Observable<LoadingState<D>>;
  readonly snapshot$: Observable<DocumentSnapshot<T>>;
  readonly snapshotLoadingState$: Observable<LoadingState<DocumentSnapshot<T>>>;
  readonly currentData$: Observable<Maybe<DocumentDataWithId<T>>>;
  readonly data$: Observable<DocumentDataWithId<T>>;
  readonly dataLoadingState$: Observable<LoadingState<DocumentDataWithId<T>>>;
  readonly exists$: Observable<boolean>;
  readonly modelIdentity$: Observable<FirestoreModelIdentity>;

  setId: (observableOrValue: ObservableOrValue<Maybe<FirestoreModelId>>) => Subscription;
  setKey: (observableOrValue: ObservableOrValue<Maybe<FirestoreModelKey>>) => Subscription;
  setRef: (observableOrValue: ObservableOrValue<Maybe<DocumentReference<T>>>) => Subscription;

  /**
   * Clears the key/id/ref and current document from the store.
   */
  clearRefs: () => void;

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
  readonly id?: Maybe<FirestoreModelId>;
  readonly key?: Maybe<FirestoreModelKey>;
  readonly ref?: Maybe<DocumentReference<T>>;
}

/**
 * Used for storing the state of a Person and related email threads.
 */
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

  readonly snapshot$: Observable<DocumentSnapshot<T>> = this.document$.pipe(
    switchMap((x) => x.accessor.stream()),
    shareReplay(1)
  );

  readonly snapshotLoadingState$: Observable<LoadingState<DocumentSnapshot<T>>> = this.currentDocument$.pipe(
    switchMap(() => loadingStateFromObs(this.snapshot$)),
    shareReplay(1)
  );

  readonly currentData$: Observable<Maybe<DocumentDataWithId<T>>> = this.document$.pipe(
    switchMap((x) => x.accessor.stream().pipe(map((y) => documentDataWithId(y)))),
    shareReplay(1)
  );

  readonly data$: Observable<DocumentDataWithId<T>> = this.currentDocument$.pipe(
    switchMap(() => this.currentData$.pipe(filterMaybe())),
    shareReplay(1)
  );

  readonly dataLoadingState$: Observable<LoadingState<DocumentDataWithId<T>>> = this.snapshotLoadingState$.pipe(
    map((x) => {
      let result: LoadingState<DocumentDataWithId<T>>;

      if (x.value) {
        const data = documentDataWithId(x.value);

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
  /**
   * Sets the id of the document to load.
   */
  readonly setId = this.updater((state, id: Maybe<FirestoreModelId>) => (id ? { ...state, id, key: undefined, ref: undefined } : { ...state, id })) as (observableOrValue: Maybe<string> | Observable<Maybe<string>>) => Subscription;

  /**
   * Sets the key of the document to load.
   */
  readonly setKey = this.updater((state, key: Maybe<FirestoreModelKey>) => (key ? { ...state, key, id: undefined, ref: undefined } : { ...state, key })) as (observableOrValue: Maybe<string> | Observable<Maybe<string>>) => Subscription;

  /**
   * Sets the ref of the document to load.
   */
  readonly setRef = this.updater((state, ref: Maybe<DocumentReference<T>>) => (ref ? { ...state, key: undefined, id: undefined, ref } : { ...state, ref })) as (observableOrValue: Maybe<DocumentReference<T>> | Observable<Maybe<DocumentReference<T>>>) => Subscription;

  readonly clearRefs = this.updater((state) => ({ ...state, id: undefined, key: undefined, ref: undefined }));

  readonly setFirestoreCollection = this.updater((state, firestoreCollection: Maybe<FirestoreCollection<T, D>>) => ({ ...state, firestoreCollection }));
  readonly setFirestoreCollectionLike = this.updater((state, firestoreCollectionLike: Maybe<FirestoreCollectionLike<T, D>>) => ({ ...state, firestoreCollectionLike }));
}
