import { PageListLoadingState, cleanupDestroyable, filterMaybe, useFirst, SubscriptionObject, accumulatorFlattenPageListLoadingState, ItemAccumulatorNextPageUntilResultsCountFunction, itemAccumulatorNextPageUntilResultsCount, iteratorNextPageUntilPage, iteratorNextPageUntilMaxPageLoadLimit, pageItemAccumulatorCurrentPage, ItemAccumulatorNextPageUntilResultsCountResult, iterationHasNextAndCanLoadMore, ObservableOrValue, distinctUntilKeysChange } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, map, shareReplay, distinctUntilChanged, Subject, throttleTime, switchMap, Observable, tap, startWith, NEVER, share, of } from 'rxjs';
import {
  DocumentDataWithIdAndKey,
  DocumentReference,
  FirebaseQueryItemAccumulator,
  firebaseQueryItemAccumulator,
  FirebaseQueryItemAccumulatorNextPageUntilResultsCountFunction,
  FirebaseQuerySnapshotAccumulator,
  firebaseQuerySnapshotAccumulator,
  FirestoreCollectionLike,
  FirestoreDocument,
  FirestoreItemPageIterationInstance,
  FirestoreItemPageIteratorFilter,
  FirestoreModelKey,
  FirestoreQueryConstraint,
  IterationQueryDocChangeWatcher,
  iterationQueryDocChangeWatcher,
  loadDocumentsForDocumentReferences
} from '@dereekb/firebase';
import { ArrayOrValue, Destroyable, GetterOrValue, Initialized, Maybe, PageNumber, countAllInNestedArray } from '@dereekb/util';
import { DbxFirebaseCollectionLoaderAccessor, DbxFirebaseCollectionLoaderWithAccumulator } from './collection.loader';

/**
 * The store mode.
 *
 * - query: The store will load documents from a query, using the given collection.
 * - references: The store will load documents from the input references (keys, refs, etc.).
 */
export type DbxFirebaseCollectionMode = 'query' | 'references';

export interface DbxFirebaseCollectionLoaderInstanceInitConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly collection?: Maybe<FirestoreCollectionLike<T, D>>;
  readonly collectionMode?: DbxFirebaseCollectionMode;
  readonly collectionKeys?: Maybe<FirestoreModelKey[]>;
  readonly collectionRefs?: Maybe<DocumentReference<T>[]>;
  readonly maxPages?: Maybe<number>;
  readonly itemsPerPage?: Maybe<number>;
  readonly constraints?: Maybe<ArrayOrValue<FirestoreQueryConstraint>>;
  /**
   * Whether or not to wait for non-null constraints before beginning the iteration.
   *
   * Defaults to true.
   */
  readonly waitForNonNullConstraints?: Maybe<boolean>;
}

export type DbxFirebaseCollectionLoaderInstanceData<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> = DbxFirebaseCollectionLoaderAccessor<T>;

/**
 * DbxFirebaseModelLoader implementation within an instance.
 */
export class DbxFirebaseCollectionLoaderInstance<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>> implements DbxFirebaseCollectionLoaderWithAccumulator<T>, DbxFirebaseCollectionLoaderInstanceData<T, D>, Initialized, Destroyable {
  private readonly _maxPagesSub = new SubscriptionObject();

  protected readonly _collection = new BehaviorSubject<Maybe<FirestoreCollectionLike<T, D>>>(undefined);

  protected readonly _collectionMode = new BehaviorSubject<DbxFirebaseCollectionMode>('query');
  protected readonly _collectionRefs = new BehaviorSubject<Maybe<DocumentReference<T>[]>>(undefined);
  protected readonly _maxPages = new BehaviorSubject<Maybe<number>>(undefined);
  protected readonly _itemsPerPage = new BehaviorSubject<Maybe<number>>(undefined);
  protected readonly _constraints = new BehaviorSubject<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>(undefined);
  protected readonly _waitForNonNullConstraints = new BehaviorSubject<Maybe<boolean>>(undefined);
  protected readonly _restart = new Subject<void>();

  readonly collection$ = this._collection.pipe(distinctUntilChanged());

  readonly collectionMode$ = this._collectionMode.pipe(distinctUntilChanged(), shareReplay(1));
  readonly currentCollectionRefs$ = this._collectionRefs.pipe(distinctUntilChanged(), shareReplay(1));
  readonly collectionRefs$ = this.currentCollectionRefs$.pipe(
    filterMaybe(),
    distinctUntilKeysChange((x) => x.path),
    shareReplay(1)
  );
  readonly collectionKeys$ = this.collectionRefs$.pipe(
    map((x) => x.map((y) => y.path)),
    shareReplay(1)
  );

  readonly currentConstraints$ = this._constraints.pipe(distinctUntilChanged());

  readonly constraints$ = this._waitForNonNullConstraints.pipe(
    switchMap((waitForNonNullConstraints) => {
      let obs: Observable<Maybe<ArrayOrValue<FirestoreQueryConstraint>>> = this.currentConstraints$;

      // defaults to true
      if (waitForNonNullConstraints !== false) {
        obs = this.currentConstraints$.pipe(filterMaybe());
      }

      return obs;
    }),
    shareReplay(1)
  );

  readonly iteratorFilter$: Observable<FirestoreItemPageIteratorFilter> = combineLatest([this._itemsPerPage.pipe(distinctUntilChanged()), this.constraints$]).pipe(
    map(([limit, constraints]) => ({ limit, constraints, maxPageLoadLimit: this.maxPages }) as FirestoreItemPageIteratorFilter),
    shareReplay(1)
  );

  readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>> = this.collection$.pipe(
    switchMap((collection) => {
      if (collection) {
        return combineLatest([this.collectionMode$, this.iteratorFilter$, this._restart.pipe(startWith(undefined))]).pipe(
          throttleTime(100, undefined, { trailing: true }), // prevent rapid changes and executing filters too quickly.
          switchMap(([mode, filter]) => {
            if (mode === 'query') {
              return of(collection.firestoreIteration(filter));
            } else {
              return this.collectionRefs$.pipe(map((refs) => collection.firestoreFixedIteration(refs, filter)));
            }
          }),
          cleanupDestroyable(), // cleanup the iteration
          shareReplay(1)
        );
      } else {
        return NEVER; // don't emit anything until collection is provided.
      }
    }),
    cleanupDestroyable(), // cleanup the iteration
    shareReplay(1)
  );

  readonly queryChangeWatcher$: Observable<IterationQueryDocChangeWatcher<T>> = this.firestoreIteration$.pipe(
    map((instance) => iterationQueryDocChangeWatcher({ instance })),
    shareReplay(1)
  );

  readonly snapshotAccumulator$: Observable<FirebaseQuerySnapshotAccumulator<T>> = this.firestoreIteration$.pipe(
    map((x) => firebaseQuerySnapshotAccumulator<T>(x)),
    cleanupDestroyable(),
    shareReplay(1)
  );

  readonly hasNext$: Observable<boolean> = this.firestoreIteration$.pipe(
    switchMap((x) => x.hasNext$),
    shareReplay(1)
  );

  readonly canLoadMore$: Observable<boolean> = this.firestoreIteration$.pipe(
    switchMap((x) => x.canLoadMore$),
    shareReplay(1)
  );

  readonly hasNextAndCanLoadMore$: Observable<boolean> = this.firestoreIteration$.pipe(
    switchMap((x) => iterationHasNextAndCanLoadMore(x)),
    shareReplay(1)
  );

  readonly snapshotAccumulatorDocumentRefs$: Observable<DocumentReference<T>[][]> = this.snapshotAccumulator$.pipe(
    switchMap((x) => x.allItems$.pipe(map((y) => y.map((z) => z.map((zz) => zz.ref))))),
    shareReplay(1)
  );

  readonly snapshotAccumulatorDocuments$: Observable<D[][]> = combineLatest([this.collection$.pipe(filterMaybe()), this.snapshotAccumulatorDocumentRefs$]).pipe(
    map(([collection, documentRefs]) => {
      const accessor = collection.documentAccessor();
      return documentRefs.map((y) => y.map((z) => accessor.loadDocument(z)));
    }),
    shareReplay(1)
  );

  readonly accumulator$: Observable<FirebaseQueryItemAccumulator<T>> = this.firestoreIteration$.pipe(
    map((x) => firebaseQueryItemAccumulator<T>(x)),
    cleanupDestroyable(),
    shareReplay(1)
  );

  readonly accumulatorPage$: Observable<PageNumber> = this.accumulator$.pipe(
    switchMap((x) => pageItemAccumulatorCurrentPage(x)),
    shareReplay(1)
  );

  /**
   * Passthrough for currentAllItems$ from the accumulator.
   */
  readonly currentAccumulatorItems$: Observable<DocumentDataWithIdAndKey<T>[][]> = this.accumulator$.pipe(
    switchMap((x) => x.currentAllItems$),
    shareReplay(1)
  );

  /**
   * Passthrough for allItems$ from the accumulator.
   */
  readonly accumulatorItems$: Observable<DocumentDataWithIdAndKey<T>[][]> = this.accumulator$.pipe(
    switchMap((x) => x.allItems$),
    shareReplay(1)
  );

  /**
   * Returns true if the first page result has one or more documents.
   */
  readonly hasDocuments$: Observable<boolean> = this.firestoreIteration$.pipe(
    switchMap((x) => x.firstState$.pipe(map((x) => Boolean(x.value?.length)))),
    shareReplay(1)
  );

  readonly allDocumentRefs$: Observable<DocumentReference<T>[]> = this.snapshotAccumulatorDocumentRefs$.pipe(
    map((x) => x.flat()),
    shareReplay(1)
  );

  readonly allDocuments$: Observable<D[]> = this.snapshotAccumulatorDocuments$.pipe(
    map((x) => x.flat()),
    shareReplay(1)
  );

  readonly allDocumentData$: Observable<DocumentDataWithIdAndKey<T>[]> = this.accumulatorItems$.pipe(
    map((x) => x.flat()),
    shareReplay(1)
  );

  readonly pageLoadingState$: Observable<PageListLoadingState<DocumentDataWithIdAndKey<T>>> = this.accumulator$.pipe(
    switchMap((x) => accumulatorFlattenPageListLoadingState(x)),
    shareReplay(1)
  );

  constructor(initConfig?: DbxFirebaseCollectionLoaderInstanceInitConfig<T, D>) {
    this._collectionMode.next(initConfig?.collectionMode ?? 'query');

    if (initConfig?.collectionKeys) {
      this.collectionKeys = initConfig?.collectionKeys;
    } else if (initConfig?.collectionRefs) {
      this.collectionRefs = initConfig?.collectionRefs;
    }

    this._collection.next(initConfig?.collection);
    this._maxPages.next(initConfig?.maxPages);
    this._itemsPerPage.next(initConfig?.itemsPerPage);
    this._constraints.next(initConfig?.constraints);
  }

  init(): void {
    // When max pages changes, update the iteration's max page limit.
    this._maxPagesSub.subscription = this._maxPages
      .pipe(
        distinctUntilChanged(),
        filterMaybe(), // do not pass null/undefined values
        switchMap((maxPageLoadLimit) =>
          this.firestoreIteration$.pipe(
            tap((iteration) => {
              iteration.setMaxPageLoadLimit(maxPageLoadLimit);
            })
          )
        )
      )
      .subscribe();
  }

  destroy(): void {
    this._collectionMode.complete();
    this._collectionRefs.complete();
    this._maxPages.complete();
    this._collection.complete();
    this._constraints.complete();
    this._itemsPerPage.complete();
    this._restart.complete();
    this._maxPagesSub.destroy();
  }

  // MARK: Inputs
  get collectionMode(): DbxFirebaseCollectionMode {
    return this._collectionMode.value;
  }

  set collectionMode(mode: DbxFirebaseCollectionMode) {
    if (this.collectionMode != mode) {
      this._collectionMode.next(mode);
    }
  }

  get collectionKeys(): Maybe<FirestoreModelKey[]> {
    const refs = this.collectionRefs;
    return refs?.map((x) => x.path);
  }

  set collectionKeys(keys: Maybe<FirestoreModelKey[]>) {
    let refs: Maybe<DocumentReference<T>[]> = undefined;
    const { collection } = this;

    if (keys && collection) {
      const accessor = collection.documentAccessor();
      refs = keys.map((x) => accessor.documentRefForKey(x));
    }

    this.collectionRefs = refs;
  }

  get collectionRefs(): Maybe<DocumentReference<T>[]> {
    return this._collectionRefs.value;
  }

  set collectionRefs(refs: Maybe<DocumentReference<T>[]>) {
    this._collectionRefs.next(refs);
  }

  get maxPages(): Maybe<number> {
    return this._maxPages.value;
  }

  set maxPages(maxPages: Maybe<number>) {
    if (this.maxPages != maxPages) {
      this._maxPages.next(maxPages);
    }
  }

  get itemsPerPage(): Maybe<number> {
    return this._itemsPerPage.value;
  }

  set itemsPerPage(itemsPerPage: Maybe<number>) {
    if (this.itemsPerPage != itemsPerPage) {
      this._itemsPerPage.next(itemsPerPage);
    }
  }

  get constraints(): Maybe<ArrayOrValue<FirestoreQueryConstraint>> {
    return this._constraints.value;
  }

  set constraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>) {
    this._constraints.next(constraints);
  }

  get waitForNonNullConstraints(): Maybe<boolean> {
    return this._waitForNonNullConstraints.value;
  }

  set waitForNonNullConstraints(waitForNonNullConstraints: Maybe<boolean>) {
    this._waitForNonNullConstraints.next(waitForNonNullConstraints);
  }

  get collection(): Maybe<FirestoreCollectionLike<T, D>> {
    return this._collection.value;
  }

  set collection(collection: Maybe<FirestoreCollectionLike<T, D>>) {
    this._collection.next(collection);
  }

  // MARK: DbxFirebaseCollectionLoader
  next() {
    useFirst(this.firestoreIteration$, (x) => x.next());
  }

  restart() {
    this._restart.next();
  }

  setCollectionMode(mode: DbxFirebaseCollectionMode) {
    this.collectionMode = mode;
  }

  // References Mode
  setCollectionKeys(keys: Maybe<FirestoreModelKey[]>): void {
    this.collectionKeys = keys;
  }

  setCollectionRefs(refs: Maybe<DocumentReference<T>[]>): void {
    this.collectionRefs = refs;
  }

  // Query Mode
  setMaxPages(maxPages: Maybe<number>) {
    this.maxPages = maxPages;
  }

  setItemsPerPage(itemsPerPage: Maybe<number>) {
    this.itemsPerPage = itemsPerPage;
  }

  setConstraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>) {
    this.constraints = constraints;
  }

  setWaitForNonNullConstraints(waitForNonNullConstraints: Maybe<boolean>) {
    this.waitForNonNullConstraints = waitForNonNullConstraints;
  }

  setCollection(firestoreCollection: Maybe<FirestoreCollectionLike<T, D>>) {
    this.collection = firestoreCollection;
  }

  loadPagesUntilResultsCount(maxResultsLimit: GetterOrValue<number>, countResultsFunction?: FirebaseQueryItemAccumulatorNextPageUntilResultsCountFunction<T> | undefined): Observable<ItemAccumulatorNextPageUntilResultsCountResult> {
    const defaultFn: ItemAccumulatorNextPageUntilResultsCountFunction<DocumentDataWithIdAndKey<T>[]> = countAllInNestedArray;
    return this.accumulator$.pipe(
      switchMap((accumulator) =>
        itemAccumulatorNextPageUntilResultsCount({
          accumulator,
          maxResultsLimit,
          countResultsFunction: countResultsFunction ?? defaultFn
        })
      )
    );
  }

  loadToPage(page: PageNumber): Observable<PageNumber> {
    return this.accumulator$.pipe(switchMap((accumulator) => iteratorNextPageUntilPage(accumulator.itemIteration, page)));
  }

  loadAllResults(): Observable<PageNumber> {
    return this.accumulator$.pipe(switchMap((accumulator) => iteratorNextPageUntilMaxPageLoadLimit(accumulator.itemIteration)));
  }
}

export function dbxFirebaseCollectionLoaderInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: DbxFirebaseCollectionLoaderInstanceInitConfig<T, D>): DbxFirebaseCollectionLoaderInstance<T, D> {
  return new DbxFirebaseCollectionLoaderInstance<T, D>(config);
}

export function dbxFirebaseCollectionLoaderInstanceWithCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(collection: Maybe<FirestoreCollectionLike<T, D>>): DbxFirebaseCollectionLoaderInstance<T, D> {
  return new DbxFirebaseCollectionLoaderInstance<T, D>({ collection });
}
