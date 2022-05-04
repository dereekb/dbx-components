import { Injectable } from '@angular/core';
import { Observable, shareReplay, distinctUntilChanged, map, switchMap, combineLatest, Subscription } from 'rxjs';
import { DocumentSnapshot, DocumentReference, FirestoreCollection, FirestoreDocument, documentDataWithId, DocumentDataWithId } from '@dereekb/firebase';
import { filterMaybe, LoadingState, beginLoading, successResult, loadingStateFromObs, errorResult, ObservableOrValue } from '@dereekb/rxjs';
import { Maybe, ModelKey, isMaybeSo } from '@dereekb/util';
import { LockSetComponentStore } from '@dereekb/dbx-core';
import { modelDoesNotExistError } from '../error';

export interface DbxFirebaseDocumentStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly firestoreCollection$: Observable<FirestoreCollection<T, D>>;

  readonly currentInputId$: Observable<Maybe<ModelKey>>;
  readonly inputId$: Observable<ModelKey>;
  readonly currentInputRef$: Observable<Maybe<DocumentReference<T>>>;
  readonly inputRef$: Observable<DocumentReference<T>>;

  readonly currentDocument$: Observable<Maybe<D>>;
  readonly document$: Observable<D>;
  readonly id$: Observable<ModelKey>;
  readonly ref$: Observable<DocumentReference<T>>;
  readonly documentLoadingState$: Observable<LoadingState<D>>;
  readonly snapshot$: Observable<DocumentSnapshot<T>>;
  readonly snapshotLoadingState$: Observable<LoadingState<DocumentSnapshot<T>>>;
  readonly data$: Observable<Maybe<DocumentDataWithId<T>>>;
  readonly dataLoadingState$: Observable<LoadingState<DocumentDataWithId<T>>>;
  readonly exists$: Observable<boolean>;

  setId: (observableOrValue: ObservableOrValue<string>) => Subscription;
  setRef: (observableOrValue: ObservableOrValue<DocumentReference<T>>) => Subscription;
  setFirestoreCollection: (observableOrValue: ObservableOrValue<FirestoreCollection<T, D>>) => Subscription;
}

export interface DbxFirebaseDocumentStoreContextState<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly firestoreCollection: FirestoreCollection<T, D>;
  readonly id?: Maybe<ModelKey>;
  readonly ref?: Maybe<DocumentReference<T>>;
}

/**
 * Used for storing the state of a Person and related email threads.
 */
@Injectable()
export class AbstractDbxFirebaseDocumentStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, C extends DbxFirebaseDocumentStoreContextState<T, D> = DbxFirebaseDocumentStoreContextState<T, D>> extends LockSetComponentStore<C> implements DbxFirebaseDocumentStore<T, D> {

  // MARK: Effects


  // MARK: Accessors
  readonly firestoreCollection$: Observable<FirestoreCollection<T, D>> = this.state$.pipe(
    map(x => x.firestoreCollection),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentInputId$: Observable<Maybe<ModelKey>> = this.state$.pipe(
    map(x => x.id),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly inputId$: Observable<ModelKey> = this.currentInputId$.pipe(
    filterMaybe(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentInputRef$: Observable<Maybe<DocumentReference<T>>> = this.state$.pipe(
    map(x => x.ref),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly inputRef$: Observable<DocumentReference<T>> = this.currentInputRef$.pipe(
    filterMaybe(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentDocument$: Observable<Maybe<D>> = combineLatest([this.firestoreCollection$, this.currentInputId$, this.currentInputRef$]).pipe(
    map(([collection, id, ref]) => {
      let document: Maybe<D>;

      if (ref) {
        document = collection.documentAccessor().loadDocument(ref);
      } else if (id) {
        document = collection.documentAccessor().loadDocumentForPath(id);
      }

      return document;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly document$: Observable<D> = this.currentDocument$.pipe(
    filterMaybe(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly documentLoadingState$: Observable<LoadingState<D>> = this.currentDocument$.pipe(
    map(x => (x) ? successResult(x) : beginLoading()),
    shareReplay(1)
  );

  readonly id$: Observable<ModelKey> = this.document$.pipe(
    map(x => x.id),
    shareReplay()
  );

  readonly ref$: Observable<DocumentReference<T>> = this.document$.pipe(
    map(x => x.documentRef),
    shareReplay()
  );

  readonly snapshot$: Observable<DocumentSnapshot<T>> = this.document$.pipe(
    switchMap(x => x.accessor.stream()),
    shareReplay(1)
  );

  readonly snapshotLoadingState$: Observable<LoadingState<DocumentSnapshot<T>>> = this.currentDocument$.pipe(
    switchMap(_ => loadingStateFromObs(this.snapshot$)),
    shareReplay(1)
  );

  readonly data$: Observable<Maybe<DocumentDataWithId<T>>> = this.document$.pipe(
    switchMap(x => x.accessor.stream().pipe(map(y => documentDataWithId(y)))),
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

  readonly exists$: Observable<boolean> = this.data$.pipe(
    map(x => isMaybeSo(x)),
    shareReplay(1)
  );

  // MARK: State Changes
  /**
   * Sets the id of the document to load.
   */
  readonly setId = this.updater((state, id: ModelKey) => (id) ? ({ ...state, id, ref: undefined }) : ({ ...state, id }));

  /**
   * Sets the id of the document to load.
   */
  readonly setRef = this.updater((state, ref: DocumentReference<T>) => (ref) ? ({ ...state, id: undefined, ref }) : ({ ...state, ref }));

  /**
   * Sets the id of the document to load.
   */
  readonly setFirestoreCollection = this.updater((state, firestoreCollection: FirestoreCollection<T, D>) => ({ ...state, firestoreCollection }));

}
