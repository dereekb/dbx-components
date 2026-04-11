import { switchMap, distinctUntilChanged, shareReplay, map, type Observable, BehaviorSubject, of, combineLatest, EMPTY, skip, defaultIfEmpty } from 'rxjs';
import { type FilterSource } from './filter';
import { distinctUntilObjectValuesChanged } from '../object';
import { asObservable, type MaybeObservableOrValue } from '../rxjs/getter';
import { switchMapFilterMaybe, filterMaybe } from '../rxjs/value';
import { type Destroyable, type Maybe } from '@dereekb/util';
import { SubscriptionObject } from '../subscription';

/**
 * Configuration for initializing a {@link FilterSourceInstance}.
 */
export interface FilterSourceInstanceConfig<F> {
  /**
   * Observable used to initialize the filter value, taking priority over the default.
   */
  readonly initWithFilter?: Maybe<Observable<F>>;
  /**
   * Default filter value or observable, used as a fallback when no explicit filter is set.
   */
  readonly defaultFilter?: MaybeObservableOrValue<F>;
  /**
   * Explicit filter value to set immediately.
   */
  readonly filter?: Maybe<F>;
}

/**
 * Concrete implementation of {@link FilterSource} that manages reactive filter state with
 * support for default values, initial values, and explicit overrides.
 *
 * Filter priority (highest to lowest):
 * 1. Explicit filter set via {@link setFilter}
 * 2. Initial filter set via {@link initWithFilter}
 * 3. Default filter set via {@link setDefaultFilter}
 *
 * @example
 * ```ts
 * const source = new FilterSourceInstance<{ active: boolean }>();
 *
 * // Set a default filter
 * source.setDefaultFilter(of({ active: false }));
 *
 * // Override with an explicit filter
 * source.setFilter({ active: true });
 *
 * // Reset back to default
 * source.resetFilter();
 * ```
 */
export class FilterSourceInstance<F> implements FilterSource<F>, Destroyable {
  private readonly _initialFilterSub = new SubscriptionObject();
  private readonly _initialFilterTakesPriority = new BehaviorSubject<boolean>(false);

  private readonly _filter = new BehaviorSubject<Maybe<F>>(undefined);

  /**
   * The initial filter can only pass through observables that always emit a value.
   */
  private readonly _initialFilter = new BehaviorSubject<Maybe<Observable<F>>>(undefined);
  private readonly _defaultFilter = new BehaviorSubject<Maybe<Observable<Maybe<F>>>>(undefined);

  /**
   * Observable of the default filter value, emitting when a default is set.
   */
  readonly defaultFilter$: Observable<Maybe<F>> = this._defaultFilter.pipe(switchMapFilterMaybe());

  /**
   * Observable that emits the initial filter value, preferring the init filter over the default.
   */
  readonly initialFilter$: Observable<Maybe<F>> = combineLatest([this._initialFilter, this._defaultFilter]).pipe(
    map(([a, b]) => a ?? b),
    switchMapFilterMaybe(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Observable of the active filter value, resolving to the explicit filter if set,
   * otherwise falling back to the initial/default filter. Deduplicated by deep value equality.
   */
  readonly filter$: Observable<F> = this._filter.pipe(
    switchMap((x) => (x != null ? of(x) : this.initialFilter$)),
    filterMaybe(), // Only provided non-maybe filter values.
    distinctUntilObjectValuesChanged(),
    shareReplay(1)
  );

  constructor(config?: FilterSourceInstanceConfig<F>) {
    const { initWithFilter, defaultFilter, filter } = config ?? {};

    if (initWithFilter != null) {
      this.initWithFilter(initWithFilter);
    }

    if (defaultFilter != null) {
      this.setDefaultFilter(defaultFilter);
    }

    if (filter != null) {
      this.setFilter(filter);
    }
  }

  /**
   * Sets an initial filter observable that takes priority over the default filter.
   *
   * @param filterObs - observable providing the initial filter value
   */
  initWithFilter(filterObs: Observable<F>): void {
    this._initialFilter.next(filterObs);
    this.initFilterTakesPriority();
  }

  /**
   * Sets the default filter, used as a fallback when no explicit or initial filter is active.
   *
   * @param filter - default filter value, observable, or undefined to clear
   */
  setDefaultFilter(filter: MaybeObservableOrValue<F>): void {
    this._defaultFilter.next(asObservable(filter));
  }

  /**
   * Sets an explicit filter value that takes priority over the initial and default filters.
   *
   * @param filter - the filter value to set
   */
  setFilter(filter: F): void {
    this._filter.next(filter);
  }

  /**
   * Resets the current filter to be the default filter.
   */
  resetFilter(): void {
    this._filter.next(undefined);
  }

  /**
   * Controls whether changes to the initial filter automatically reset the explicit filter.
   *
   * When enabled, any new emission from the initial filter observable clears the explicit
   * filter, causing `filter$` to fall back to the initial filter value.
   *
   * @param initialFilterTakesPriority - whether initial filter changes should reset the explicit filter
   */
  setInitialFilterTakesPriority(initialFilterTakesPriority: boolean) {
    this._initialFilterTakesPriority.next(initialFilterTakesPriority);
    this.initFilterTakesPriority();
  }

  // MARK: Init
  protected initFilterTakesPriority() {
    this._initialFilterSub.subscription ??= this._initialFilterTakesPriority
      .pipe(
        switchMap((clearFilterOnInitialFilterPush) => {
          if (clearFilterOnInitialFilterPush) {
            return this._initialFilter.pipe(
              switchMap((x) => x ?? EMPTY),
              filterMaybe(),
              map(() => true),
              skip(1) // skip the first emission
            );
          }

          return EMPTY;
        }),
        defaultIfEmpty(false)
      )
      .subscribe((clear) => {
        if (clear) {
          this.resetFilter();
        }
      });
  }

  /**
   * Completes all internal subjects and cleans up subscriptions.
   */
  destroy(): void {
    this._initialFilterSub.destroy();
    this._initialFilterTakesPriority.complete();
    this._filter.complete();
    this._initialFilter.complete();
    this._defaultFilter.complete();
  }
}
