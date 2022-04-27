import { itemAccumulator, iterationCurrentPageListLoadingState, PageListLoadingState, cleanupDestroyable, filterMaybe, useFirst, SubscriptionObject } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, map, shareReplay, distinctUntilChanged, Subject, throttleTime, switchMap, Observable, tap, startWith } from 'rxjs';
import { FirestoreCollection, FirestoreDocument, FirestoreItemPageIteratorFilter, FirestoreQueryConstraint } from '@dereekb/firebase';
import { ArrayOrValue, Destroyable, Initialized, Maybe } from '@dereekb/util';
import { DbxFirebaseModelLoader } from './model.loader';

/**
 * DbxFirebaseModelLoader implementation within an instance.
 */
export class DbxFirebaseModelLoaderInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> implements DbxFirebaseModelLoader<T>, Initialized, Destroyable {

  protected readonly _collection = new BehaviorSubject<Maybe<FirestoreCollection<T, D>>>(this._inputCollection);

  protected readonly _maxPages = new BehaviorSubject<Maybe<number>>(undefined);
  protected readonly _itemsPerPage = new BehaviorSubject<Maybe<number>>(undefined);
  protected readonly _constraints = new BehaviorSubject<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>(undefined);
  protected readonly _reset = new Subject<void>();

  private readonly _maxPagesSub = new SubscriptionObject();

  readonly collection$ = this._collection.pipe(filterMaybe());
  readonly constraints$ = this._constraints.pipe(distinctUntilChanged());

  readonly iteratorFilter$: Observable<FirestoreItemPageIteratorFilter> = combineLatest([
    this._itemsPerPage.pipe(distinctUntilChanged()),
    this.constraints$
  ]).pipe(
    map(([limit, constraints]) => ({ limit, constraints, maxPageLoadLimit: this.maxPages }) as FirestoreItemPageIteratorFilter),
    shareReplay(1)
  );

  readonly firestoreIteration$ = combineLatest([this.collection$, this.iteratorFilter$, this._reset.pipe(startWith(undefined))]).pipe(
    throttleTime(100, undefined, { trailing: true }),  // prevent rapid changes and executing filters too quickly.
    map(([collection, iteratorFilter]) => collection.firestoreIteration(iteratorFilter)),
    cleanupDestroyable(), // cleanup the iteration
    shareReplay(1)
  );

  readonly accumulator$ = this.firestoreIteration$.pipe(
    map(x => itemAccumulator(x)),
    cleanupDestroyable(),
    shareReplay(1)
  );

  readonly pageLoadingState$: Observable<PageListLoadingState<T>> = this.accumulator$.pipe(
    switchMap(x => iterationCurrentPageListLoadingState(x) as Observable<PageListLoadingState<T>>),
    shareReplay(1)
  );

  constructor(private readonly _inputCollection?: Maybe<FirestoreCollection<T, D>>) { }

  init(): void {

    // When max pages changes, update the iteration's max page limit.
    this._maxPagesSub.subscription = this._maxPages.pipe(
      distinctUntilChanged(),
      filterMaybe(),  // do not pass null/undefined values
      switchMap((maxPageLoadLimit) => this.firestoreIteration$.pipe(
        tap((iteration) => {
          iteration.maxPageLoadLimit = maxPageLoadLimit;
        })
      ))
    ).subscribe();
  }

  destroy(): void {
    this._maxPages.complete();
    this._collection.complete();
    this._constraints.complete();
    this._itemsPerPage.complete();
    this._reset.complete();
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

  // MARK: DbxFirebaseModelList
  next() {
    useFirst(this.firestoreIteration$, (x) => x.next());
  }

  reset() {
    this._reset.next();
  }

  setConstraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>) {
    this._constraints.next(constraints);
  }

  setCollection(firestoreCollection: FirestoreCollection<T, D>) {
    this._collection.next(firestoreCollection);
  }

}

export function dbxFirebaseModelLoaderInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(inputCollection: Maybe<FirestoreCollection<T, D>>): DbxFirebaseModelLoaderInstance<T, D> {
  return new DbxFirebaseModelLoaderInstance<T, D>(inputCollection);
}
