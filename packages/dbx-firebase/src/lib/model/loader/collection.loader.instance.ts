import { PageListLoadingState, cleanupDestroyable, filterMaybe, useFirst, SubscriptionObject, accumulatorFlattenPageListLoadingState } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, map, shareReplay, distinctUntilChanged, Subject, throttleTime, switchMap, Observable, tap, startWith, NEVER } from 'rxjs';
import { FirebaseQueryItemAccumulator, firebaseQueryItemAccumulator, FirestoreCollectionLike, FirestoreDocument, FirestoreItemPageIterationInstance, FirestoreItemPageIteratorFilter, FirestoreQueryConstraint, IterationQueryDocChangeWatcher, iterationQueryDocChangeWatcher } from '@dereekb/firebase';
import { ArrayOrValue, Destroyable, Initialized, Maybe } from '@dereekb/util';
import { DbxFirebaseCollectionLoader } from './collection.loader';

export interface DbxFirebaseCollectionLoaderInstanceInitConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  collection?: Maybe<FirestoreCollectionLike<T, D>>;
  maxPages?: Maybe<number>;
  itemsPerPage?: Maybe<number>;
  constraints?: Maybe<ArrayOrValue<FirestoreQueryConstraint>>;
}

export interface DbxFirebaseCollectionLoaderInstanceData<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>>;
  readonly accumulator$: Observable<FirebaseQueryItemAccumulator<T>>;
  readonly pageLoadingState$: Observable<PageListLoadingState<T>>;
}

/**
 * DbxFirebaseModelLoader implementation within an instance.
 */
export class DbxFirebaseCollectionLoaderInstance<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>> implements DbxFirebaseCollectionLoader<T>, DbxFirebaseCollectionLoaderInstanceData<T, D>, Initialized, Destroyable {
  protected readonly _collection = new BehaviorSubject<Maybe<FirestoreCollectionLike<T, D>>>(this._initConfig?.collection);

  protected readonly _maxPages = new BehaviorSubject<Maybe<number>>(this._initConfig?.maxPages);
  protected readonly _itemsPerPage = new BehaviorSubject<Maybe<number>>(this._initConfig?.itemsPerPage);
  protected readonly _constraints = new BehaviorSubject<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>(this._initConfig?.constraints);
  protected readonly _restart = new Subject<void>();

  private readonly _maxPagesSub = new SubscriptionObject();

  readonly collection$ = this._collection.pipe(distinctUntilChanged());
  readonly constraints$ = this._constraints.pipe(distinctUntilChanged());

  readonly iteratorFilter$: Observable<FirestoreItemPageIteratorFilter> = combineLatest([this._itemsPerPage.pipe(distinctUntilChanged()), this.constraints$]).pipe(
    map(([limit, constraints]) => ({ limit, constraints, maxPageLoadLimit: this.maxPages } as FirestoreItemPageIteratorFilter)),
    shareReplay(1)
  );

  readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>> = this.collection$.pipe(
    switchMap((collection) => {
      if (collection) {
        return combineLatest([this.iteratorFilter$, this._restart.pipe(startWith(undefined))]).pipe(
          throttleTime(100, undefined, { trailing: true }), // prevent rapid changes and executing filters too quickly.
          map(([iteratorFilter]) => collection.firestoreIteration(iteratorFilter)),
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

  readonly accumulator$: Observable<FirebaseQueryItemAccumulator<T>> = this.firestoreIteration$.pipe(
    map((x) => firebaseQueryItemAccumulator<T>(x)),
    cleanupDestroyable(),
    shareReplay(1)
  );

  readonly pageLoadingState$: Observable<PageListLoadingState<T>> = this.accumulator$.pipe(
    switchMap((x) => accumulatorFlattenPageListLoadingState(x) as Observable<PageListLoadingState<T>>),
    shareReplay(1)
  );

  constructor(private readonly _initConfig?: DbxFirebaseCollectionLoaderInstanceInitConfig<T, D>) {}

  init(): void {
    // When max pages changes, update the iteration's max page limit.
    this._maxPagesSub.subscription = this._maxPages
      .pipe(
        distinctUntilChanged(),
        filterMaybe(), // do not pass null/undefined values
        switchMap((maxPageLoadLimit) =>
          this.firestoreIteration$.pipe(
            tap((iteration) => {
              iteration.maxPageLoadLimit = maxPageLoadLimit;
            })
          )
        )
      )
      .subscribe();
  }

  destroy(): void {
    this._maxPages.complete();
    this._collection.complete();
    this._constraints.complete();
    this._itemsPerPage.complete();
    this._restart.complete();
    this._maxPagesSub.destroy();
  }

  // MARK: Inputs
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

  get collection(): Maybe<FirestoreCollectionLike<T, D>> {
    return this._collection.value;
  }

  set collection(collection: Maybe<FirestoreCollectionLike<T, D>>) {
    this._collection.next(collection);
  }

  // MARK: DbxFirebaseModelList
  next() {
    useFirst(this.firestoreIteration$, (x) => x.next());
  }

  restart() {
    this._restart.next();
  }

  setConstraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>) {
    this.constraints = constraints;
  }

  setCollection(firestoreCollection: Maybe<FirestoreCollectionLike<T, D>>) {
    this.collection = firestoreCollection;
  }
}

export function dbxFirebaseCollectionLoaderInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: DbxFirebaseCollectionLoaderInstanceInitConfig<T, D>): DbxFirebaseCollectionLoaderInstance<T, D> {
  return new DbxFirebaseCollectionLoaderInstance<T, D>(config);
}

export function dbxFirebaseCollectionLoaderInstanceWithCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(collection: Maybe<FirestoreCollectionLike<T, D>>): DbxFirebaseCollectionLoaderInstance<T, D> {
  return new DbxFirebaseCollectionLoaderInstance<T, D>({ collection });
}
