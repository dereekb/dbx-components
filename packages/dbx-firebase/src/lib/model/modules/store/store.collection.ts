import { Injectable } from '@angular/core';
import { Observable, shareReplay, distinctUntilChanged, Subscription, first, map, switchMap, tap } from 'rxjs';
import { FirebaseQueryItemAccumulator, FirestoreCollectionLike, FirestoreDocument, FirestoreItemPageIterationInstance, FirestoreQueryConstraint, IterationQueryDocChangeWatcher, DocumentDataWithIdAndKey, DocumentReference, FirebaseQuerySnapshotAccumulator, FirebaseQueryItemAccumulatorNextPageUntilResultsCountFunction, FirestoreModelKey } from '@dereekb/firebase';
import { ObservableOrValue, cleanupDestroyable, PageListLoadingState, filterMaybe, ItemAccumulatorNextPageUntilResultsCountResult } from '@dereekb/rxjs';
import { ArrayOrValue, Maybe, PageNumber } from '@dereekb/util';
import { LockSetComponentStore } from '@dereekb/dbx-core';
import { DbxFirebaseCollectionLoaderInstance, dbxFirebaseCollectionLoaderInstance, DbxFirebaseCollectionLoaderInstanceData, DbxFirebaseCollectionLoaderInstanceInitConfig, DbxFirebaseCollectionMode } from '../../loader/collection.loader.instance';
import { DbxFirebaseCollectionLoaderAccessorWithAccumulator } from '../../loader/collection.loader';

export interface DbxFirebaseCollectionStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends DbxFirebaseCollectionLoaderAccessorWithAccumulator<T>, DbxFirebaseCollectionLoaderInstanceData<T, D> {
  /**
   * The current collection that documents are loaded from.
   */
  readonly firestoreCollection$: Observable<Maybe<FirestoreCollectionLike<T, D>>>;
  /**
   * The current store mode.
   */
  readonly collectionMode$: Observable<DbxFirebaseCollectionMode>;
  /**
   * The loader instance.
   */
  readonly loader$: Observable<DbxFirebaseCollectionLoaderInstance<T, D>>;
  /**
   * Whether or not the iterator has more pages to load.
   */
  readonly hasNext$: Observable<boolean>;
  /**
   * Whether or not the iterator can load more pages.
   */
  readonly canLoadMore$: Observable<boolean>;
  /**
   * Whether or not the iterator has more pages to load and can load more pages.
   */
  readonly hasNextAndCanLoadMore$: Observable<boolean>;
  /**
   * Returns true if the collection has documents.
   */
  readonly hasDocuments$: Observable<boolean>;
  /**
   * Returns all document references loaded by the accumulator.
   */
  readonly allDocumentRefs$: Observable<DocumentReference<T>[]>;
  /**
   * Returns all documents loaded by the accomulator.
   */
  readonly allDocuments$: Observable<D[]>;
  /**
   * Returns all documents data loaded by the accumulator.
   */
  readonly allDocumentData$: Observable<DocumentDataWithIdAndKey<T>[]>;

  setCollectionMode(observableOrValue: ObservableOrValue<DbxFirebaseCollectionMode>): Subscription;

  // References Mode
  setCollectionKeys(observableOrValue: ObservableOrValue<Maybe<FirestoreModelKey[]>>): Subscription;
  setCollectionRefs(observableOrValue: ObservableOrValue<Maybe<DocumentReference<T>[]>>): Subscription;

  // Query Mode
  setMaxPages(observableOrValue: ObservableOrValue<Maybe<number>>): Subscription;
  setItemsPerPage(observableOrValue: ObservableOrValue<Maybe<number>>): Subscription;
  setConstraints(observableOrValue: ObservableOrValue<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>): Subscription;
  setWaitForNonNullConstraints(observableOrValue: ObservableOrValue<Maybe<boolean>>): Subscription;
  next(observableOrValue: ObservableOrValue<void>): void;
  restart(observableOrValue: ObservableOrValue<void>): void;

  readonly setFirestoreCollection: (() => void) | ((observableOrValue: ObservableOrValue<Maybe<FirestoreCollectionLike<T, D>>>) => Subscription);
}

export interface DbxFirebaseCollectionStoreContextState<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Omit<DbxFirebaseCollectionLoaderInstanceInitConfig<T, D>, 'collection'> {
  readonly firestoreCollection?: Maybe<FirestoreCollectionLike<T, D>>;
}

@Injectable()
export class AbstractDbxFirebaseCollectionStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, C extends DbxFirebaseCollectionStoreContextState<T, D> = DbxFirebaseCollectionStoreContextState<T, D>> extends LockSetComponentStore<C> implements DbxFirebaseCollectionStore<T, D> {
  // MARK: Effects
  readonly setCollectionMode = this.effect((input: Observable<DbxFirebaseCollectionMode>) => {
    return input.pipe(switchMap((mode) => this.loader$.pipe(tap((x) => x.setCollectionMode(mode)))));
  });

  readonly setCollectionKeys = this.effect((input: Observable<Maybe<FirestoreModelKey[]>>) => {
    return input.pipe(switchMap((keys) => this.loader$.pipe(tap((x) => x.setCollectionKeys(keys)))));
  });

  readonly setCollectionRefs = this.effect((input: Observable<Maybe<DocumentReference<T>[]>>) => {
    return input.pipe(switchMap((refs) => this.loader$.pipe(tap((x) => x.setCollectionRefs(refs)))));
  });

  readonly setMaxPages = this.effect((input: Observable<Maybe<number>>) => {
    return input.pipe(switchMap((maxPages) => this.loader$.pipe(tap((x) => x.setMaxPages(maxPages)))));
  });

  readonly setItemsPerPage = this.effect((input: Observable<Maybe<number>>) => {
    return input.pipe(switchMap((itemsPerPage) => this.loader$.pipe(tap((x) => x.setItemsPerPage(itemsPerPage)))));
  });

  readonly setConstraints = this.effect((input: Observable<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>) => {
    return input.pipe(switchMap((constraints) => this.loader$.pipe(tap((x) => x.setConstraints(constraints)))));
  });

  readonly setWaitForNonNullConstraints = this.effect((input: Observable<Maybe<boolean>>) => {
    return input.pipe(switchMap((waitForNonNullConstraints) => this.loader$.pipe(tap((x) => x.setWaitForNonNullConstraints(waitForNonNullConstraints)))));
  });

  readonly next = this.effect((input: Observable<void>) => {
    return input.pipe(
      switchMap(() =>
        this.loader$.pipe(
          first(),
          tap((x) => x.next())
        )
      )
    );
  });

  readonly restart = this.effect((input: Observable<void>) => {
    return input.pipe(
      switchMap(() =>
        this.loader$.pipe(
          first(),
          tap((x) => x.restart())
        )
      )
    );
  });

  // MARK: Accessors
  readonly currentFirestoreCollection$: Observable<Maybe<FirestoreCollectionLike<T, D>>> = this.state$.pipe(
    map((x) => x.firestoreCollection),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly firestoreCollection$: Observable<FirestoreCollectionLike<T, D>> = this.currentFirestoreCollection$.pipe(filterMaybe());

  readonly loader$: Observable<DbxFirebaseCollectionLoaderInstance<T, D>> = this.currentFirestoreCollection$.pipe(
    switchMap((collection) =>
      this.state$.pipe(
        first(),
        map((x) =>
          dbxFirebaseCollectionLoaderInstance({
            collection,
            collectionMode: x.collectionMode,
            collectionKeys: x.collectionKeys,
            collectionRefs: x.collectionRefs,
            maxPages: x.maxPages,
            itemsPerPage: x.itemsPerPage,
            constraints: x.constraints,
            waitForNonNullConstraints: x.waitForNonNullConstraints
          })
        )
      )
    ),
    cleanupDestroyable(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly collectionMode$: Observable<DbxFirebaseCollectionMode> = this.loader$.pipe(switchMap((x) => x.collectionMode$));
  readonly constraints$: Observable<Maybe<ArrayOrValue<FirestoreQueryConstraint>>> = this.loader$.pipe(switchMap((x) => x.constraints$));
  readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>> = this.loader$.pipe(switchMap((x) => x.firestoreIteration$));
  readonly queryChangeWatcher$: Observable<IterationQueryDocChangeWatcher<T>> = this.loader$.pipe(switchMap((x) => x.queryChangeWatcher$));
  readonly pageLoadingState$: Observable<PageListLoadingState<DocumentDataWithIdAndKey<T>>> = this.loader$.pipe(switchMap((x) => x.pageLoadingState$));
  readonly snapshotAccumulator$: Observable<FirebaseQuerySnapshotAccumulator<T>> = this.loader$.pipe(switchMap((x) => x.snapshotAccumulator$));
  readonly accumulator$: Observable<FirebaseQueryItemAccumulator<T>> = this.loader$.pipe(switchMap((x) => x.accumulator$));

  readonly hasNext$: Observable<boolean> = this.loader$.pipe(switchMap((x) => x.hasNext$));
  readonly canLoadMore$: Observable<boolean> = this.loader$.pipe(switchMap((x) => x.canLoadMore$));
  readonly hasNextAndCanLoadMore$: Observable<boolean> = this.loader$.pipe(switchMap((x) => x.hasNextAndCanLoadMore$));

  readonly hasDocuments$: Observable<boolean> = this.loader$.pipe(switchMap((x) => x.hasDocuments$));
  readonly allDocumentRefs$: Observable<DocumentReference<T>[]> = this.loader$.pipe(switchMap((x) => x.allDocumentRefs$));
  readonly allDocuments$: Observable<D[]> = this.loader$.pipe(switchMap((x) => x.allDocuments$));
  readonly allDocumentData$: Observable<DocumentDataWithIdAndKey<T>[]> = this.loader$.pipe(switchMap((x) => x.allDocumentData$));

  readonly setFirestoreCollection = this.updater((state, firestoreCollection: FirestoreCollectionLike<T, D> | null | undefined) => ({ ...state, firestoreCollection }));

  loadToPage(page: PageNumber): Observable<PageNumber> {
    return this.loader$.pipe(switchMap((x) => x.loadToPage(page)));
  }

  loadPagesUntilResultsCount(maxResultsCount: number, countFunction?: FirebaseQueryItemAccumulatorNextPageUntilResultsCountFunction<T> | undefined): Observable<ItemAccumulatorNextPageUntilResultsCountResult> {
    return this.loader$.pipe(switchMap((x) => x.loadPagesUntilResultsCount(maxResultsCount, countFunction)));
  }

  loadAllResults(): Observable<PageNumber> {
    return this.loader$.pipe(switchMap((x) => x.loadAllResults()));
  }
}
