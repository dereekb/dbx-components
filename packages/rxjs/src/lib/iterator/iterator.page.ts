import { filterMaybe } from '../rxjs';
import { type PageLoadingState, isLoadingStateWithError, isLoadingStateFinishedLoading, isLoadingStateLoading, successPageResult, mapLoadingStateResults, startWithBeginLoading } from '../loading';
import { FIRST_PAGE, type Destroyable, type Filter, filteredPage, getNextPageNumber, hasValueOrNotEmpty, type Maybe, type PageNumber, type Page, isMaybeNot, type Configurable, invertMaybeBoolean } from '@dereekb/util';
import { distinctUntilChanged, map, scan, startWith, catchError, skip, mergeMap, delay, BehaviorSubject, combineLatest, exhaustMap, filter, first, type Observable, of, type OperatorFunction, shareReplay, defaultIfEmpty } from 'rxjs';
import { type ItemIteratorNextRequest, type PageItemIteration } from './iteration';
import { iterationHasNextAndCanLoadMore } from './iteration.next';

/**
 * Configuration for limiting the number of pages that can be loaded by a page iterator.
 */
export interface ItemPageLimit {
  /**
   * Maximum number of pages to load. Should be defined in most cases to prevent
   * unbounded iteration. If not defined, there is no limit.
   */
  readonly maxPageLoadLimit?: Maybe<number>;
}

/**
 * Request object passed to the {@link ItemPageIteratorDelegate.loadItemsForPage} method,
 * providing all context needed to load a specific page.
 */
export interface ItemPageIteratorRequest<V, F, C extends ItemPageIterationConfig<F> = ItemPageIterationConfig<F>> extends Page {
  /**
   * The base iterator config.
   */
  readonly iteratorConfig: C;
  /**
   * Page being loaded.
   */
  readonly page: PageNumber;
  /**
   * Suggested limit of items to load per request.
   */
  readonly limit?: number;
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

/**
 * Result returned by the delegate for a single page load, containing the loaded values
 * and pagination status.
 */
export interface ItemPageIteratorResult<V> {
  /**
   * Error result.
   */
  readonly error?: Error;
  /**
   * Returned values.
   */
  readonly value?: V;
  /**
   * True if the end has been reached.
   *
   * Alternatively, end is implied if values is undefined or empty.
   *
   * False can be specified to note that despite having no values passed, the end has not yet been reached.
   */
  readonly end?: boolean;
}

/**
 * Delegate responsible for loading items for a given page request.
 * Implementations define the data-fetching logic for each page.
 */
export interface ItemPageIteratorDelegate<V, F, C extends ItemPageIterationConfig<F> = ItemPageIterationConfig<F>> {
  /**
   * Returns an observable of items given the input request.
   *
   * If the input goes out of bounds, the result should be an empty array.
   */
  loadItemsForPage(request: ItemPageIteratorRequest<V, F, C>): Observable<ItemPageIteratorResult<V>>;
}

interface InternalItemPageIteratorNext extends ItemIteratorNextRequest {
  n: number;
}

/**
 * Combined configuration for page iteration, including filter criteria and page limits.
 */
export interface ItemPageIterationConfig<F = unknown> extends Filter<F>, ItemPageLimit {}

/**
 * Default maximum number of pages that can be loaded by an {@link ItemPageIterator}.
 */
export const DEFAULT_ITEM_PAGE_ITERATOR_MAX = 100;

/**
 * Factory for creating paginated iteration instances from a delegate and configuration.
 *
 * The iterator itself holds the delegate (data-loading logic) and optional global page limits.
 * Call {@link instance} to create a new iteration session with a specific configuration.
 *
 * @example
 * ```ts
 * const iterator = new ItemPageIterator({
 *   loadItemsForPage: (request) => fetchPage(request.page)
 * });
 *
 * const instance = iterator.instance({ filter: 'active', maxPageLoadLimit: 10 });
 * instance.next(); // loads first page
 * ```
 */
export class ItemPageIterator<V, F, C extends ItemPageIterationConfig<F> = ItemPageIterationConfig<F>> {
  private readonly _delegate: ItemPageIteratorDelegate<V, F, C>;

  protected _maxPageLoadLimit: Maybe<number>;

  constructor(delegate: ItemPageIteratorDelegate<V, F, C>) {
    this._delegate = delegate;
  }

  get delegate() {
    return this._delegate;
  }

  get maxPageLoadLimit() {
    return this._maxPageLoadLimit;
  }

  set maxPageLoadLimit(maxPageLoadLimit: Maybe<number>) {
    this._maxPageLoadLimit = maxPageLoadLimit;
  }

  getMaxPageLoadLimit(): Maybe<number> {
    return this.maxPageLoadLimit;
  }

  setMaxPageLoadLimit(maxPageLoadLimit: Maybe<number>): void {
    this._maxPageLoadLimit = maxPageLoadLimit;
  }

  /**
   * Creates a new iteration instance with the given configuration.
   *
   * @param config - filter and page limit configuration for this iteration session
   * @returns new iteration instance ready to begin loading pages
   */
  instance(config: C): ItemPageIterationInstance<V, F, C> {
    return new ItemPageIterationInstance(this, config);
  }
}

/**
 * Internal state snapshot of an {@link ItemPageIterationInstance}, tracking the current
 * and historical loading states across page loads.
 */
export interface ItemPageIterationInstanceState<V> {
  /**
   * Used for tracking the start/end of a specific next call.
   */
  readonly n: number;
  readonly current: Maybe<PageLoadingState<ItemPageIteratorResult<V>>>;
  /**
   * The first finished state. May not always be the same as firstSuccessful if the first state has an error.
   */
  readonly firstFinished: Maybe<PageLoadingState<ItemPageIteratorResult<V>>>;
  readonly latestFinished: Maybe<PageLoadingState<ItemPageIteratorResult<V>>>;
  readonly firstSuccessful: Maybe<PageLoadingState<ItemPageIteratorResult<V>>>;
  readonly lastSuccessful: Maybe<PageLoadingState<ItemPageIteratorResult<V>>>;
}

/**
 * Active iteration session created by an {@link ItemPageIterator}.
 *
 * Manages the lifecycle of paginated loading: triggering page loads via {@link next},
 * tracking loading/success/error states, and exposing all results as reactive observables.
 * Implements {@link PageItemIteration} for use with accumulators and other iteration utilities.
 */
export class ItemPageIterationInstance<V, F, C extends ItemPageIterationConfig<F> = ItemPageIterationConfig<F>> implements PageItemIteration<V, PageLoadingState<V>>, Destroyable {
  private readonly _iterator: ItemPageIterator<V, F, C>;
  private readonly _config: C;

  /**
   * Used for triggering loading of more content.
   */
  private readonly _next = new BehaviorSubject<InternalItemPageIteratorNext>({ n: 0 });
  private readonly _maxPageLoadLimit = new BehaviorSubject<Maybe<number>>(undefined);

  constructor(iterator: ItemPageIterator<V, F, C>, config: C) {
    this._iterator = iterator;
    this._config = config;
    this._maxPageLoadLimit.next(config.maxPageLoadLimit ?? iterator.getMaxPageLoadLimit());
  }

  get iterator() {
    return this._iterator;
  }

  get config() {
    return this._config;
  }

  // MARK: State
  readonly state$: Observable<ItemPageIterationInstanceState<V>> = this._next.pipe(
    delay(0),
    exhaustMap((request) =>
      combineLatest([this.hasNextAndCanLoadMore$, this._lastFinishedPageResultState$]).pipe(
        first(),
        map(([hasNextAndCanLoadMore, prevResult]: [boolean, Maybe<PageLoadingState<ItemPageIteratorResult<V>>>]) => [itemPageIteratorShouldLoadNextPage(request, hasNextAndCanLoadMore, prevResult), prevResult] as [boolean, Maybe<PageLoadingState<ItemPageIteratorResult<V>>>]),
        mergeMap(([shouldLoadNextPage, prevResult]: [boolean, Maybe<PageLoadingState<ItemPageIteratorResult<V>>>]) => {
          if (shouldLoadNextPage) {
            const nextPageNumber = nextIteratorPageNumber(prevResult); // retry number if error occured
            const page = filteredPage(nextPageNumber, this._config);

            const iteratorResultObs = this._iterator.delegate
              .loadItemsForPage({
                iteratorConfig: this._config,
                page: nextPageNumber,
                lastItem$: this._lastFinishedPageResultItem$,
                lastResult$: this._lastFinishedPageResult$,
                lastState$: this._lastFinishedPageResultState$
              })
              .pipe(catchError((error) => of({ error } as ItemPageIteratorResult<V>).pipe(first())));

            const stateObs: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = iteratorResultObs.pipe(
              first(),
              map((result) => {
                if (result.error != null) {
                  return {
                    loading: false,
                    page: nextPageNumber,
                    error: result.error,
                    value: result
                  };
                } else {
                  return successPageResult(nextPageNumber, result);
                }
              }),
              startWithBeginLoading(page),
              shareReplay(1)
            );

            return stateObs;
          } else {
            return of(prevResult).pipe();
          }
        }),
        map((inputState) => {
          let state: Maybe<PageLoadingState<ItemPageIteratorResult<V>>>;

          if (inputState != null) {
            const end = inputState.value != null ? isItemPageIteratorResultEndResult(inputState.value as ItemPageIteratorResult<V>) : undefined;
            state = { ...inputState, hasNextPage: invertMaybeBoolean(end) };
          }

          const result = { n: request.n, state };
          return result;
        })
      )
    ),
    scan(
      (acc: ItemPageIterationInstanceState<V>, x: { n: number; state: Maybe<PageLoadingState<ItemPageIteratorResult<V>>> }) => {
        const { n, state: curr } = x;

        const next = {
          n,
          current: curr,
          firstFinished: acc.firstFinished,
          latestFinished: acc.latestFinished,
          firstSuccessful: acc.firstSuccessful,
          lastSuccessful: acc.lastSuccessful
        };

        // If it was a replay of the previous result, change nothing.
        if (acc.current !== curr) {
          if (isLoadingStateFinishedLoading(curr)) {
            // only set first finished once
            if (!next.firstFinished) {
              next.firstFinished = curr;
            }

            next.latestFinished = curr;

            if (!isLoadingStateWithError(curr)) {
              next.lastSuccessful = curr;

              if (!next.firstSuccessful) {
                next.firstSuccessful = curr;
              }
            }
          }
        }

        return next;
      },
      {
        n: -1,
        current: { page: FIRST_PAGE }, // Start with loading the first page
        firstFinished: undefined,
        latestFinished: undefined,
        firstSuccessful: undefined,
        lastSuccessful: undefined
      }
    ),
    shareReplay(1)
  );

  /**
   * Used to track when a next() value changes, or the current changes.
   *
   * This returns the n value of next.
   */
  readonly _nextTrigger$: Observable<ItemPageIterationInstanceState<V>> = this.state$.pipe(
    distinctUntilChanged((a, b) => a.n === b.n && a.current === b.current),
    shareReplay(1),
    skip(1) // Wait until a new state is emitted
  );

  /**
   * Same as _nextTrigger$, but catches finished loading events.
   */
  readonly _nextFinished$: Observable<ItemPageIterationInstanceState<V>> = this._nextTrigger$.pipe(filter((x) => isLoadingStateFinishedLoading(x.current)));

  /**
   * The first page results that finished loading.
   */
  readonly firstPageResultState$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this.state$.pipe(
    map((x) => x.firstFinished),
    filterMaybe(),
    shareReplay(1)
  );

  /**
   * The current page being loaded or the latest page finished loading.
   */
  readonly currentPageResultState$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this.state$.pipe(
    map((x) => x.current),
    filterMaybe(),
    shareReplay(1)
  );

  /**
   * The latest page results that has finished loading.
   */
  readonly latestPageResultState$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this.state$.pipe(
    map((x) => x.latestFinished),
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
    map((x) => !x.hasNextPage),
    startWith(false), // Has not reached the end
    shareReplay(1)
  );

  private readonly _currentPageResultState$: Observable<Maybe<PageLoadingState<ItemPageIteratorResult<V>>>> = this.currentPageResultState$.pipe(startWith(undefined), shareReplay(1));

  /**
   * Whether or not items are currently being loaded.
   */
  readonly isLoading$ = this._currentPageResultState$.pipe(
    map((x) => isLoadingStateLoading(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  private readonly _lastFinishedPageResultState$: Observable<Maybe<PageLoadingState<ItemPageIteratorResult<V>>>> = this.latestPageResultState$.pipe(startWith(undefined), shareReplay(1));

  private readonly _lastFinishedPageResult$: Observable<Maybe<ItemPageIteratorResult<V>>> = this._lastFinishedPageResultState$.pipe(map((x) => x?.value));
  private readonly _lastFinishedPageResultItem$: Observable<Maybe<V>> = this._lastFinishedPageResult$.pipe(map((x) => x?.value));

  /**
   * The first page results that has finished loading without an error.
   */
  readonly firstSuccessfulPageResults$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this.state$.pipe(
    map((x) => x.firstSuccessful),
    filterMaybe(),
    shareReplay(1)
  );

  /**
   * The latest page results that has finished loading without an error.
   */
  readonly latestSuccessfulPageResults$: Observable<PageLoadingState<ItemPageIteratorResult<V>>> = this.state$.pipe(
    map((x) => x.lastSuccessful),
    filterMaybe(),
    shareReplay(1)
  );

  // MARK: PageItemIteration
  getMaxPageLoadLimit(): Maybe<number> {
    return this._maxPageLoadLimit.value;
  }

  setMaxPageLoadLimit(maxPageLoadLimit: Maybe<number>): void {
    const limit = isMaybeNot(maxPageLoadLimit) ? undefined : Math.max(0, Math.ceil(maxPageLoadLimit));
    this._maxPageLoadLimit.next(limit);
  }

  nextPage(request: ItemIteratorNextRequest = {}): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this._nextFinished$
        .pipe(
          exhaustMap(() => this.latestPageResultState$),
          defaultIfEmpty({ error: undefined, page: -1 }),
          first()
        )
        .subscribe({
          next: (latestState) => {
            if (latestState.error) {
              reject(latestState.error);
            } else {
              resolve(latestState.page);
            }
          },
          error: (error) => {
            reject(error);
          }
        });

      this.next(request);
    });
  }

  readonly currentState$: Observable<PageLoadingState<V>> = this.currentPageResultState$.pipe(mapItemPageLoadingStateFromResultPageLoadingState(), shareReplay(1));

  readonly latestLoadedPage$: Observable<PageNumber> = this.latestPageResultState$.pipe(
    map((x) => x.page),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly numberOfPagesLoaded$: Observable<number> = this.latestLoadedPage$.pipe(
    map((x) => x + 1),
    defaultIfEmpty(0),
    shareReplay(1)
  );

  // MARK: ItemIteration
  /**
   * Whether or not there are more results to load.
   */
  readonly hasNext$: Observable<boolean> = this.hasReachedEndResult$.pipe(
    map((x) => !x),
    defaultIfEmpty(false),
    shareReplay(1)
  );

  /**
   * Whether or not the successfulPageResultsCount has passed the maxPageLoadLimit
   */
  readonly canLoadMore$: Observable<boolean> = combineLatest([this._maxPageLoadLimit, this.numberOfPagesLoaded$.pipe(startWith(0))]).pipe(
    map(([maxPageLoadLimit, numberOfPagesLoaded]) => (isMaybeNot(maxPageLoadLimit) ? true : numberOfPagesLoaded < maxPageLoadLimit)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Observable of whether or not there are items that have finished loading, and if this iterator can load more.
   */
  readonly hasNextAndCanLoadMore$: Observable<boolean> = iterationHasNextAndCanLoadMore(this);

  readonly firstState$: Observable<PageLoadingState<V>> = this.firstPageResultState$.pipe(mapItemPageLoadingStateFromResultPageLoadingState(), shareReplay(1));
  readonly latestState$: Observable<PageLoadingState<V>> = this.latestPageResultState$.pipe(mapItemPageLoadingStateFromResultPageLoadingState(), shareReplay(1));

  readonly latestItems$: Observable<Maybe<V>> = this.latestState$.pipe(
    distinctUntilChanged(),
    map((x) => x.value),
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

/**
 * Determines whether an {@link ItemPageIteratorResult} represents the end of iteration.
 *
 * End is detected when:
 * - `end` is explicitly `true`
 * - `end` is not explicitly `false` and the result value is empty/null (via `hasValueOrNotEmpty`)
 * - Error results are never considered the end
 *
 * @param result - the page result to check
 * @returns `true` if this result indicates no more pages are available
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

function itemPageIteratorShouldLoadNextPage<V = unknown>(request: ItemIteratorNextRequest, hasNextAndCanLoadMore: boolean, prevResult: Maybe<PageLoadingState<ItemPageIteratorResult<V>>>): boolean {
  return (
    hasNextAndCanLoadMore && // Must be able to load more
    Boolean(!isLoadingStateWithError(prevResult) || request.retry) && // Must not have any errors
    Boolean(request.page == null || nextIteratorPageNumber(prevResult) === request.page)
  ); // Must match the page, if provided
}

function nextIteratorPageNumber(prevResult: Maybe<PageLoadingState<ItemPageIteratorResult<unknown>>>): number {
  return isLoadingStateWithError(prevResult) ? (prevResult as PageLoadingState<unknown>).page : getNextPageNumber(prevResult);
}

function mapItemPageLoadingStateFromResultPageLoadingState<V>(): OperatorFunction<PageLoadingState<ItemPageIteratorResult<V>>, PageLoadingState<V>> {
  return map(itemPageLoadingStateFromResultPageLoadingState);
}

function itemPageLoadingStateFromResultPageLoadingState<V>(input: PageLoadingState<ItemPageIteratorResult<V>>): PageLoadingState<V> {
  const result = mapLoadingStateResults(input, {
    mapValue: (result: ItemPageIteratorResult<V>) => result.value
  }) as Configurable<PageLoadingState<V>>;
  result.hasNextPage = invertMaybeBoolean(input.value?.end);
  return result;
}
