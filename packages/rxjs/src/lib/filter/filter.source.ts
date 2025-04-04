import { switchMap, distinctUntilChanged, shareReplay, map, type Observable, BehaviorSubject, of, combineLatest, EMPTY, skip, defaultIfEmpty } from 'rxjs';
import { type FilterSource } from './filter';
import { distinctUntilObjectValuesChanged } from '../object';
import { asObservable, MaybeObservableOrValue, maybeValueFromObservableOrValue } from '../rxjs/getter';
import { filterMaybe, switchMapMaybeObs } from '../rxjs/value';
import { type Destroyable, type Maybe } from '@dereekb/util';
import { SubscriptionObject } from '../subscription';

export interface FilterSourceInstanceConfig<F> {
  readonly initWithFilter?: Maybe<Observable<F>>;
  readonly defaultFilter?: MaybeObservableOrValue<F>;
  readonly filter?: Maybe<F>;
}

/**
 * A basic FilterSource implementation.
 */
export class FilterSourceInstance<F> implements FilterSource<F>, Destroyable {
  private readonly _initialFilterSub = new SubscriptionObject();
  private readonly _initialFilterTakesPriority = new BehaviorSubject<boolean>(false);

  private readonly _filter = new BehaviorSubject<Maybe<F>>(undefined);
  private readonly _initialFilter = new BehaviorSubject<MaybeObservableOrValue<F>>(undefined);
  private readonly _defaultFilter = new BehaviorSubject<MaybeObservableOrValue<F>>(undefined);

  readonly defaultFilter$: Observable<Maybe<F>> = this._defaultFilter.pipe(maybeValueFromObservableOrValue());
  readonly initialFilter$: Observable<Maybe<F>> = combineLatest([this._initialFilter, this._defaultFilter]).pipe(
    map(([a, b]) => a ?? b),
    filterMaybe(), // observable or value should not be null/undefined
    maybeValueFromObservableOrValue(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * filter$ uses the latest value from any filter.
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

  initWithFilter(filterObs: MaybeObservableOrValue<F>): void {
    this._initialFilter.next(filterObs);
    this.initFilterTakesPriority();
  }

  setDefaultFilter(filter: MaybeObservableOrValue<F>): void {
    this._defaultFilter.next(asObservable(filter));
  }

  setFilter(filter: F): void {
    this._filter.next(filter);
  }

  /**
   * Resets the current filter to be the default filter.
   */
  resetFilter(): void {
    this._filter.next(undefined);
  }

  // MARK: Accessors
  setInitialFilterTakesPriority(initialFilterTakesPriority: boolean) {
    this._initialFilterTakesPriority.next(initialFilterTakesPriority);
    this.initFilterTakesPriority();
  }

  // MARK: Init
  protected initFilterTakesPriority() {
    if (!this._initialFilterSub.subscription) {
      this._initialFilterSub.subscription = this._initialFilterTakesPriority
        .pipe(
          switchMap((clearFilterOnInitialFilterPush) => {
            if (clearFilterOnInitialFilterPush) {
              return this._initialFilter.pipe(
                switchMap((x) => (x ? asObservable(x) : EMPTY)),
                filterMaybe(),
                map(() => true),
                skip(1) // skip the first emission
              );
            } else {
              return EMPTY;
            }
          }),
          defaultIfEmpty(false)
        )
        .subscribe((clear) => {
          if (clear) {
            this.resetFilter();
          }
        });
    }
  }

  // MARK: Cleanup
  destroy(): void {
    this._initialFilterSub.destroy();
    this._initialFilterTakesPriority.complete();
    this._filter.complete();
    this._initialFilter.complete();
    this._defaultFilter.complete();
  }

  // MARK: Compat
  /**
   * @deprecated use setInitialFilterTakesPriority instead.
   */
  set initialFilterTakesPriority(initialFilterTakesPriority: boolean) {
    this.setInitialFilterTakesPriority(initialFilterTakesPriority);
  }
}
