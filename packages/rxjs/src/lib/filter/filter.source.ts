import { switchMap, distinctUntilChanged, first, shareReplay, map, Observable, BehaviorSubject, of, combineLatest } from 'rxjs';
import { FilterSource } from './filter';
import { distinctUntilObjectValuesChanged } from '../object';
import { asObservable, ObservableGetter } from '../rxjs/getter';
import { switchMapMaybeObs, filterMaybe } from '../rxjs/value';
import { Maybe } from '@dereekb/util';

/**
 * A basic FilterSource implementation.
 */
export class FilterSourceInstance<F> implements FilterSource<F> {

  private _filter = new BehaviorSubject<Maybe<F>>(undefined);
  private _initialFilter = new BehaviorSubject<Maybe<Observable<F>>>(undefined);
  private _defaultFilter = new BehaviorSubject<Maybe<Observable<Maybe<F>>>>(undefined);

  readonly defaultFilter$: Observable<Maybe<F>> = this._defaultFilter.pipe(switchMapMaybeObs());
  readonly initialFilter$: Observable<Maybe<F>> = combineLatest([this._initialFilter, this._defaultFilter]).pipe(
    map(([a, b]) => a ?? b),
    switchMapMaybeObs(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * filter$ uses the latest value from any filter.
   */
  readonly filter$: Observable<F> = this._filter.pipe(
    switchMap(x => (x != null) ? of(x) : this.initialFilter$),
    filterMaybe(),  // Only provided non-maybe filter values.
    distinctUntilObjectValuesChanged(),
    shareReplay(1)
  );

  initWithFilter(filterObs: Observable<F>): void {
    this._initialFilter.next(filterObs);
  }

  setDefaultFilter(filter: Maybe<ObservableGetter<Maybe<F>>>): void {
    this._defaultFilter.next(asObservable(filter));
  }

  setFilter(filter: F): void {
    this._filter.next(filter);
  }

  /**
   * Resets the current filter to be the default filter.
   */
  resetFilter(): void {
    this.defaultFilter$.pipe(first()).subscribe((x) => {
      this._filter.next(x);
    });
  }

  // MARK: Cleanup
  destroy(): void {
    this._filter.complete();
    this._initialFilter.complete();
    this._defaultFilter.complete();
  }

}
