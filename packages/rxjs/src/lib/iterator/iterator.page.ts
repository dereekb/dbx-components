import { distinctUntilArrayLengthChanges, filterMaybe } from '../rxjs';
import { distinctUntilChanged, map, scan, startWith, catchError, skip, skipWhile, tap, take, mergeMap, delay } from 'rxjs/operators';
import { PageLoadingState, loadingStateHasError, loadingStateHasFinishedLoading, loadingStateIsLoading, errorPageResult, successPageResult, mapLoadingStateResults, beginLoading } from "../loading";
import { FIRST_PAGE, UNLOADED_PAGE, Destroyable, Filter, filteredPage, FilteredPage, getNextPageNumber, hasValueOrNotEmpty, Maybe, PageNumber, filterMaybeValues, lastValue } from "@dereekb/util";
import { BehaviorSubject, combineLatest, exhaustMap, filter, first, Observable, of, OperatorFunction, shareReplay } from "rxjs";
import { ItemIteratorNextRequest, PageItemIteration } from './iteration';
import { iterationHasNextAndCanLoadMore } from './iteration.next';

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
  value?: V;
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

interface InternalItemPageIteratorNext extends ItemIteratorNextRequest {
  n: number;
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
export class ItemPageIterator<V, F, C extends ItemPageIterationConfig<F> = ItemPageIterationConfig<F>> {

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
export interface ItemPageIteratorIterationInstanceState<V> {
  /**
   * Used for tracking the start/end of a specific next call.
   */
  n: number;
  current: Maybe<PageLoadingState<ItemPageIteratorResult<V>>>;
  latestFinished: Maybe<PageLoadingState<ItemPageIteratorResult<V>>>;
  lastSuccessful: Maybe<PageLoadingState<ItemPageIteratorResult<V>>>;
  allSuccessful: PageLoadingState<ItemPageIteratorResult<V>>[];
}

/**
 * Configured Iterator instance.
 */
export class ItemPageIteratorIterationInstance<V, F, C extends ItemPageIterationConfig<F> = ItemPageIterationConfig<F>> implements PageItemIteration<V>, Destroyable {

  /**
   * Used for triggering loading of more content.
   */
  private readonly _next = new BehaviorSubject<InternalItemPageIteratorNext>({ n: 0 });

  private readonly _maxPageLoadLimit = new BehaviorSubject(this.iterator.maxPageLoadLimit);

  constructor(readonly iterator: ItemPageIterator<V, F, C>, readonly config: C) { }

  // MARK: State
  readonly state$: Observable<ItemPageIteratorIterationInstanceState<V>> = this._next.pipe(
    delay(0),
    exhaustMap((request) =>
      combineLatest([this.hasNextAndCanLoadMore$, this._lastFinishedPageResultState$]).pipe(
        first(),
        map(([hasNextAndCanLoadMore, prevResult]) => ([itemPageIteratorShouldLoadNextPage(request, hasNextAndCanLoadMore, prevResult), prevResult])),
        mergeMap(([shouldLoadNextPage, prevResult]: [boolean, PageLoadingState<ItemPageIteratorResult<V>>]) => {

          if (shouldLoadNextPage) {
            const nextPageNumber = nextIteratorPageNumber(prevResult);  // retry number if error occured
            const page = filteredPage(nextPageNumber, this.config);

            const iteratorResultObs = this.iterator.delegate.loadItemsForPage({
              page,
              lastItem$: this._lastFinishedPageResultItem$,
              lastResult$: this._lastFinishedPageResult$,
              lastState$: this._lastFinishedPageResultState$
            }).pipe(
              catchError((error) => of({ error } as ItemPageIteratorResult<V>).pipe(first()))
            );

            const stateObs: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = iteratorResultObs.pipe(
              first(),
              map((result) => {
                if (result.error != null) {
                  return {
                    loading: false,
                    page: nextPageNumber,
                    error: result.error,
                    model: result
                  };
                } else {
                  return successPageResult(nextPageNumber, result);
                }
              }),
              startWith(beginLoading<ItemPageIteratorResult<V>>(page) as PageLoadingState<ItemPageIteratorResult<V>>),
              shareReplay(1)
            );

            return stateObs;
          } else {
            return of(prevResult).pipe();
          }
        }),
        map((state) => ({ n: request.n, state }))
      )
    ),
    scan((acc: ItemPageIteratorIterationInstanceState<V>, x: { n: number, state: PageLoadingState<ItemPageIteratorResult<V>> }) => {
      const { n, state: curr } = x;

      let next = {
        n,
        current: curr,
        latestFinished: acc.latestFinished,
        lastSuccessful: acc.lastSuccessful,
        allSuccessful: acc.allSuccessful
      };

      // If it was a replay of the previous result, change nothing.
      if (acc.current !== curr) {
        if (loadingStateHasFinishedLoading(curr)) {
          next.latestFinished = curr;

          if (!loadingStateHasError(curr)) {
            next.lastSuccessful = curr;
            acc.allSuccessful.push(curr);
          }
        }
      }

      return next;
    }, {
      current: { page: FIRST_PAGE },  // Start with loading the first page
      latestFinished: undefined, lastSuccessful: undefined, allSuccessful: []
    }),
    shareReplay(1)
  );

  /**
   * Used to track when a next() value changes, or the current changes.
   * 
   * This returns the n value of next.
   */
  readonly _nextTrigger$: Observable<ItemPageIteratorIterationInstanceState<V>> = this.state$.pipe(
    distinctUntilChanged((a, b) => a.n === b.n && a.current === b.current),
    shareReplay(1),
    skip(1) // Wait until a new state is emitted
  );

  /**
   * Same as _nextTrigger$, but catches finished loading events.
   */
  readonly _nextFinished$: Observable<ItemPageIteratorIterationInstanceState<V>> = this._nextTrigger$.pipe(
    filter(x => loadingStateHasFinishedLoading(x.current))
  );

  /**
   * The current page being loaded or the latest page finished loading.
   */
  readonly currentPageResultState$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this.state$.pipe(
    map(x => x.current),
    filterMaybe(),
    shareReplay(1)
  );

  /**
   * The latest page results that has finished loading.
   */
  readonly latestPageResultState$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this.state$.pipe(
    map(x => x.latestFinished),
    filterMaybe(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Whether or not the final item has been loaded.
   * 
   * This observable will return false to the first listener, and will wait to emit again until the current state has finished loading, if loading.
   * 
   * Will emit every time the latest page has finished loading.
   */
  readonly hasReachedEndResult$: Observable<boolean> = this.latestPageResultState$.pipe(
    map(x => isItemPageIteratorResultEndResult(x.model)),
    startWith(false),  // Has not reached the end
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

  private readonly _lastFinishedPageResultState$: Observable<Maybe<PageLoadingState<ItemPageIteratorResult<V>>>> = this.latestPageResultState$.pipe(
    startWith(undefined as Maybe<PageLoadingState<ItemPageIteratorResult<V>>>),
    shareReplay(1)
  );

  private readonly _lastFinishedPageResult$: Observable<Maybe<ItemPageIteratorResult<V>>> = this._lastFinishedPageResultState$.pipe(map(x => x?.model));
  private readonly _lastFinishedPageResultItem$: Observable<Maybe<V>> = this._lastFinishedPageResult$.pipe(map(x => x?.value));

  /**
   * The latest page results that has finished loading without an error.
   */
  readonly latestSuccessfulPageResults$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this.state$.pipe(
    map(x => x.lastSuccessful),
    filterMaybe(),
    shareReplay(1)
  );

  /**
   * All successful page results in a single array.
   */
  readonly allSuccessfulPageResults$: Observable<PageLoadingState<ItemPageIteratorResult<V>>[]> = this.state$.pipe(
    map(x => x.allSuccessful),
    distinctUntilArrayLengthChanges(),
    shareReplay(1)
  );

  /**
   * The total number of successful result states returned.
   */
  readonly successfulPageResultsCount$: Observable<number> = this.allSuccessfulPageResults$.pipe(
    map(x => x.length),
    shareReplay(1)
  );

  // MARK: PageItemIteration
  get maxPageLoadLimit() {
    return this._maxPageLoadLimit.value;
  }

  set maxPageLoadLimit(maxPageLoadLimit: number) {
    this._maxPageLoadLimit.next(Math.max(0, Math.ceil(maxPageLoadLimit)));
  }

  nextPage(request: ItemIteratorNextRequest = {}): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this._nextFinished$.pipe(
        exhaustMap(() => this.latestPageResultState$),
        first()
      ).subscribe({
        next: (latestState) => {
          if (latestState.error) {
            reject(latestState.error);
          } else {
            resolve(latestState.page);
          }
        }
      });

      this.next(request);
    });
  }

  readonly currentPageState$: Observable<PageLoadingState<V>> = this.currentPageResultState$.pipe(
    mapItemPageLoadingStateFromResultPageLoadingState(),
    shareReplay(1)
  );

  readonly latestLoadedPage$: Observable<PageNumber> = this.latestPageResultState$.pipe(
    map(x => x.page),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: ItemIteration
  /**
   * Whether or not there are more results to load.
   */
  readonly hasNext$: Observable<boolean> = this.hasReachedEndResult$.pipe(
    map(x => !x),
    shareReplay(1)
  );

  /**
   * Whether or not the successfulPageResultsCount has passed the maxPageLoadLimit
   */
  readonly canLoadMore$: Observable<boolean> = combineLatest([this._maxPageLoadLimit, this.latestLoadedPage$.pipe(startWith(UNLOADED_PAGE))]).pipe(
    map(([limit, count]) => count < limit),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Observable of whether or not there are items that have finished loading, and if this iterator can load more.
   */
  readonly hasNextAndCanLoadMore$: Observable<boolean> = iterationHasNextAndCanLoadMore(this);

  readonly latestState$: Observable<PageLoadingState<V>> = this.latestPageResultState$.pipe(
    mapItemPageLoadingStateFromResultPageLoadingState(),
    shareReplay(1)
  );

  readonly latestItems$: Observable<Maybe<V>> = this.latestState$.pipe(
    distinctUntilChanged(),
    map(x => x.model),
    shareReplay(1)
  );

  readonly allItems$: Observable<V[]> = this.state$.pipe(
    skipWhile(x => !x.latestFinished),   // Do not emit until the first finished state occurs.
    distinctUntilArrayLengthChanges((x) => x.allSuccessful),
    /* 
    We start with allSuccessfulPageResults$ since it contains all page results since the start of the iterator,
    and subscription to allItems may not have started at the same time.

    We use scan to add in all models coming in afterwards by pushing them into the accumulator.
    This is to prevent performance issues with very large iteration sets, since we can
    append onto the array, rather than concat/copy the array each time.
    */
    exhaustMap((state) => {
      const allPageResultsUpToFirstSubscription = state.allSuccessful;
      const firstLatestState = lastValue(allPageResultsUpToFirstSubscription);
      const seed: V[] = filterMaybeValues(allPageResultsUpToFirstSubscription.map(x => x.model?.value));

      return this.latestPageResultState$.pipe(
        skipWhile(x => x === firstLatestState),
        startWith(beginLoading()),  // Start with to prevent waiting on emissions from skip.
        scan((acc: V[], next: PageLoadingState<ItemPageIteratorResult<V>>) => {
          if (next.model?.value != null) {
            acc.push(next.model.value);
          }

          return acc;
        }, seed)
      )
    }),
    distinctUntilArrayLengthChanges(),
    shareReplay(1)
  );

  next(request: ItemIteratorNextRequest = {}): void {
    this._pushNext(request);
  }

  protected _pushNext(request: ItemIteratorNextRequest): void {
    this._next.next({
      n: this._next.value.n + 1,
      retry: request.retry,
      page: request.page
    });
  }

  // MARK: Destroyable
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

function itemPageIteratorShouldLoadNextPage<V = any>(
  request: ItemIteratorNextRequest,
  hasNextAndCanLoadMore: boolean,
  prevResult: PageLoadingState<ItemPageIteratorResult<V>>): boolean {
  return hasNextAndCanLoadMore &&                                                     // Must be able to load more
    ((!loadingStateHasError(prevResult)) || request.retry) &&                         // Must not have any errors
    (request.page == null || (nextIteratorPageNumber(prevResult) === request.page))   // Must match the page, if provided
}

function nextIteratorPageNumber(prevResult: PageLoadingState<ItemPageIteratorResult<any>>): number {
  return loadingStateHasError(prevResult) ? prevResult.page : getNextPageNumber(prevResult);
}

function mapItemPageLoadingStateFromResultPageLoadingState<V>(): OperatorFunction<PageLoadingState<ItemPageIteratorResult<V>>, PageLoadingState<V>> {
  return map(itemPageLoadingStateFromResultPageLoadingState);
}

function itemPageLoadingStateFromResultPageLoadingState<V>(input: PageLoadingState<ItemPageIteratorResult<V>>): PageLoadingState<V> {
  return mapLoadingStateResults(input, {
    mapValue: (result: ItemPageIteratorResult<V>) => result.value
  });
}
