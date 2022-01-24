import { filterMaybe } from '../rxjs';
import { distinctUntilChanged, map, scan, startWith, catchError, tap, switchMap, mergeMap } from 'rxjs/operators';
import { PageLoadingState, loadingStateHasError, loadingStateHasFinishedLoading, loadingStateIsLoading, PageListLoadingState, errorPageResult, successPageResult, mapLoadingStateResults, beginLoading } from "../loading";
import { UNLOADED_PAGE, Destroyable, Filter, filteredPage, FilteredPage, getNextPageNumber, hasValueOrNotEmpty, Maybe, PageNumber, reduceBooleansWithAndFn } from "@dereekb/util";
import { BehaviorSubject, combineLatest, exhaustMap, filter, first, Observable, of, shareReplay } from "rxjs";

export interface ItemPageIteratorRequest<V, F> {
  /**
   * Suggested limit of items to load per request.
   */
  readonly limit?: number;
  /**
   * Page being loaded.
   */
  readonly page: FilteredPage<F>;
  /**
   * Returns the last successful item, if available.
   */
  readonly lastItem$: Observable<Maybe<V>>;
  /**
   * The last successful result object, if available.
   */
  readonly lastResult$: Observable<Maybe<ItemPageIteratorResult<V>>>;
  /**
   * The last state, if available.
   */
  readonly lastState$: Observable<Maybe<PageLoadingState<ItemPageIteratorResult<V>>>>;
}

export interface ItemPageIteratorResult<V> {
  /**
   * Error result.
   */
  error?: Error;
  /**
   * Returned values.
   */
  values?: V;
  /**
   * True if the end has been reached.
   * 
   * Alternatively, end is implied if values is undefined or empty.
   * 
   * False can be specified to note that despite having no values passed, the end has not yet been reached.
   */
  end?: boolean;
}

export interface ItemPageIteratorDelegate<V, F> {

  /**
   * Returns an observable of items given the input request.
   * 
   * If the input goes out of bounds, the result should be 
   */
  loadItemsForPage: (request: ItemPageIteratorRequest<V, F>) => Observable<ItemPageIteratorResult<V>>;

}

export interface ItemPageIteratorNextRequest {
  /**
   * Whether or not to retry loading the page.
   */
  retry?: boolean;
}

export interface ItemPageIterationConfig<F = any> extends Filter<F> { }

// MARK: Iterator
/**
 * Default number of pages that can be loaded.
 */
export const DEFAULT_ITEM_PAGE_ITERATOR_MAX = 100;

/**
 * Used for generating new iterations.
 */
export class ItemPageIterator<V, F, C extends ItemPageIterationConfig<F>> {

  private _maxPageLoadLimit = DEFAULT_ITEM_PAGE_ITERATOR_MAX;

  get maxPageLoadLimit() {
    return this._maxPageLoadLimit;
  }

  constructor(readonly delegate: ItemPageIteratorDelegate<V, F>) { }

  /**
   * Creates a new instance based on the input config.
   * 
   * @param config 
   * @returns 
   */
  instance(config: C): ItemPageIteratorIterationInstance<V, F, C> {
    return new ItemPageIteratorIterationInstance(this, config);
  }

}

// MARK: Instance
/**
 * Configured Iterator instance.
 */
export class ItemPageIteratorIterationInstance<V, F, C extends ItemPageIterationConfig<F>> implements Destroyable {

  /**
   * Used for triggering loading of more content.
   */
  private readonly _next = new BehaviorSubject(0);

  private readonly _maxPageLoadLimit = new BehaviorSubject(this.iterator.maxPageLoadLimit);

  constructor(readonly iterator: ItemPageIterator<V, F, C>, readonly config: C) { }

  // MARK: Limit
  get maxPageLoadLimit() {
    return this._maxPageLoadLimit.value;
  }

  set maxPageLoadLimit(maxPageLoadLimit: number) {
    this._maxPageLoadLimit.next(maxPageLoadLimit);
  }

  // MARK: State
  /**
   * The current page being loaded or the latest page finished loading.
   */
  readonly currentPageResultState$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this._next.pipe(
    exhaustMap(() =>
      combineLatest([this.hasNextAndCanLoadMore$, this._lastFinishedPageResultState$]).pipe(
        first(),
        filter(([hasNextAndCanLoadMore]) => hasNextAndCanLoadMore), // If next is no longer detected, do nothing.
        exhaustMap(([_, prevResult]) => {

          const nextPageNumber = loadingStateHasError(prevResult) ? prevResult.page : getNextPageNumber(prevResult);  // retry number if error occured
          const page = filteredPage(nextPageNumber, this.config);

          const iteratorResultObs = this.iterator.delegate.loadItemsForPage({
            page,
            lastItem$: this._lastFinishedPageResultItem$,
            lastResult$: this._lastFinishedPageResult$,
            lastState$: this._lastFinishedPageResultState$
          }).pipe(
            catchError((error) => of({ error } as ItemPageIteratorResult<V>))
          );

          const stateObs: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = iteratorResultObs.pipe(
            first(),
            map((result) => {
              if (result.error != null) {
                return errorPageResult(nextPageNumber, result.error);
              } else {
                return successPageResult(nextPageNumber, result);
              }
            }),
            startWith(beginLoading<ItemPageIteratorResult<V>>(page) as PageLoadingState<ItemPageIteratorResult<V>>)
          );

          return stateObs;
        })
      )),
    shareReplay(1)
  );

  /**
   * The latest page results that have finished loading.
   */
  readonly latestPageResultState$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this.currentPageResultState$.pipe(
    filter(x => loadingStateHasFinishedLoading(x)),
    shareReplay(1)
  );

  /**
   * The page of the latest result.
   */
  readonly latestPageResultPage$: Observable<PageNumber> = this.latestPageResultState$.pipe(
    map(x => x.page),
    startWith(UNLOADED_PAGE),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Whether or not there is a next item.
   * 
   * This observable will wait to return until the current state has finished loading.
   * 
   * Will emit every time the latest page has finished loading.
   */
  readonly hasNext$: Observable<boolean> = this.latestPageResultState$.pipe(
    map(x => isItemPageIteratorResultEndResult(x.model)),
    startWith(true),  // Has next always starts true.
    shareReplay(1)
  );

  private readonly _currentPageResultState$: Observable<Maybe<PageLoadingState<ItemPageIteratorResult<V>>>> = this.currentPageResultState$.pipe(
    startWith(undefined as Maybe<PageLoadingState<ItemPageIteratorResult<V>>>),
    shareReplay(1)
  );

  /**
   * Whether or not items are currently being loaded.
   */
  readonly isLoading$ = this._currentPageResultState$.pipe(
    map(x => loadingStateIsLoading(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  private readonly _lastFinishedPageResultState$: Observable<Maybe<PageLoadingState<ItemPageIteratorResult<V>>>> = this.currentPageResultState$.pipe(
    filter(x => loadingStateHasFinishedLoading(x)),
    startWith(undefined as Maybe<PageLoadingState<ItemPageIteratorResult<V>>>),
    shareReplay(1)
  );

  private readonly _lastFinishedPageResult$: Observable<Maybe<ItemPageIteratorResult<V>>> = this._lastFinishedPageResultState$.pipe(map(x => x?.model));
  private readonly _lastFinishedPageResultItem$: Observable<Maybe<V>> = this._lastFinishedPageResult$.pipe(map(x => x?.values));

  /**
   * The latest page results that has finished loading without an error.
   */
  readonly latestSuccessfulPageResults$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this.latestPageResultState$.pipe(
    filter(x => !loadingStateHasError(x)),
    shareReplay(1)
  );

  /**
   * All successful page results in a single array.
   */
  readonly allSuccessfulPageResults$: Observable<PageLoadingState<ItemPageIteratorResult<V>>[]> = this.latestSuccessfulPageResults$.pipe(
    scan((acc: PageLoadingState<ItemPageIteratorResult<V>>[], next) => {
      return acc.concat(next);
    }, []),
    shareReplay(1)
  );

  /**
   * The total number of successful result states returned.
   * 
   * Is not related to the number of items returned.
   */
  readonly successfulPageResultsCount$: Observable<number> = this.allSuccessfulPageResults$.pipe(map(x => x.length), startWith(0), shareReplay(1));

  readonly canLoadMore$: Observable<boolean> = combineLatest([this._maxPageLoadLimit, this.successfulPageResultsCount$]).pipe(
    map(([limit, count]) => count < limit),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Observable of whether or not there are items that have finished loading, and if this iterator can load more.
   */
  readonly hasNextAndCanLoadMore$: Observable<boolean> = combineLatest([this.hasNext$, this.canLoadMore$]).pipe(
    map(reduceBooleansWithAndFn(true)),
    shareReplay(1)
  );

  /**
   * All item values returned so far in a single array.
   */
  readonly allSuccessfulPageResultItems$: Observable<V[]> = this.allSuccessfulPageResults$.pipe(
    map(x => x.map(y => y.model.values).filter(filterMaybe)),
    shareReplay(1)
  );

  /**
   * A PageListLoadingState that captures all the values that have been loaded so far, and the current loading state of currentPageResult$.
   */
  readonly pageListLoadingState$: Observable<PageListLoadingState<V>> = combineLatest([this.currentPageResultState$, this.allSuccessfulPageResultItems$.pipe(startWith(undefined))]).pipe(
    map(([state, values]) => mapLoadingStateResults(state, {
      mapValue: () => values
    }) as PageListLoadingState<V>),
    shareReplay(1)
  );

  // MARK: Functions
  /**
   * Loads the next value.
   */
  next(): void {
    this._next.next(this._next.value + 1);
  }

  /**
   * Automatically calls next up to the current maxPageLoadLimit.
   * 
   * Will throw an error if an error is encountered.
   * @returns 
   */
  nextUntilLimit(): Promise<void> {
    return this._nextToPage(() => this.maxPageLoadLimit);
  }

  nextUntilPage(page: number): Promise<void> {
    return this._nextToPage(() => page);
  }

  protected _nextToPage(getPageLimit: () => number): Promise<void> {
    function checkPageLimit(page) {
      return page < getPageLimit();
    }

    return new Promise((resolve, reject) => {
      // Changes are triggered off of page number changes.
      const sub = this.latestPageResultPage$.pipe(distinctUntilChanged()).pipe(
        exhaustMap((latestPageNumber) => this.hasNextAndCanLoadMore$.pipe(
          map((canLoadMore) => (canLoadMore && checkPageLimit(latestPageNumber))),
          tap((canLoadMore) => {
            // Load more
            if (canLoadMore) {
              this.next();
            }
          }),
          mergeMap((canLoadMore) => {
            if (canLoadMore) {
              return this._lastFinishedPageResultState$.pipe(filter(x => x.page > latestPageNumber));
            } else {
              return this._lastFinishedPageResultState$;
            }
          }),
          first()
        ))
      ).subscribe((state) => {
        if (state.error != null) {
          reject(state.error);
          sub.unsubscribe();
        } else if (!checkPageLimit(state.page)) {
          resolve();
          sub.unsubscribe();
        }
      });
    });
  }

  destroy() {
    this._next.complete();
    this._maxPageLoadLimit.complete();
  }

}

// MARK: Utility
/**
 * Is considered the "end" result if:
 * 
 * - end is true
 * - end is not false and the result value is not empty/null. Uses hasValueOrNotEmpty internally to decide.
 * 
 * @param result 
 * @returns 
 */
export function isItemPageIteratorResultEndResult<V>(result: ItemPageIteratorResult<V>) {
  if (result.error != null) {
    return false;
  } else if (result.end != null) {
    return result.end;
  } else {
    return !hasValueOrNotEmpty(result);
  }
}
