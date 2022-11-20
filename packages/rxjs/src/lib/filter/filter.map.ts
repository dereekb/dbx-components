import { filterMaybe } from '../rxjs/value';
import { ObservableOrValue } from '../rxjs/getter';
import { FilterSourceInstance } from './filter.source';
import { BehaviorSubject, Observable, switchMap, map, distinctUntilChanged, shareReplay, first } from 'rxjs';
import { FilterSource, FilterSourceConnector } from './filter';
import { Destroyable, Maybe } from '@dereekb/util';

/**
 * Used to identify a specific filter.
 */
export type FilterMapKey = string;

/**
 * Class used to keep track of filters keyed by a specific string identifier.
 */
export class FilterMap<F> implements Destroyable {
  private readonly _map = new BehaviorSubject<Map<FilterMapKey, FilterMapItem<F>>>(new Map());

  filterForKey(key: FilterMapKey): Observable<F> {
    return this._map.pipe(
      map((x) => x.get(key)),
      filterMaybe(),
      first(), // take first since the item never changes.
      switchMap((x) => x.filter$),
      filterMaybe()
    );
  }

  addDefaultFilterObs(key: FilterMapKey, obs: Maybe<ObservableOrValue<F>>): void {
    this._itemForKey(key).setDefaultFilterObs(obs);
  }

  addFilterObs(key: FilterMapKey, obs: Observable<F>): void {
    this._itemForKey(key).setFilterObs(obs);
  }

  makeInstance(key: FilterMapKey): FilterMapKeyInstance<F> {
    return new FilterMapKeyInstance<F>(this, key);
  }

  instanceObsForKeyObs(keyObs: Observable<FilterMapKey>): Observable<FilterMapKeyInstance<F>> {
    return keyObs.pipe(
      distinctUntilChanged(),
      map((x) => this.makeInstance(x)),
      shareReplay(1)
    );
  }

  // MARK: Internal
  private _itemForKey(key: FilterMapKey): FilterMapItem<F> {
    let item = this._map.value.get(key);

    if (!item) {
      item = new FilterMapItem<F>(this, key);
      this._map.value.set(key, item);
      this._map.next(this._map.value);
    }

    return item;
  }

  // MARK: Cleanup
  destroy(): void {
    this._map.value.forEach((x) => x.destroy());
    this._map.complete();
  }
}

export class FilterMapKeyInstance<F> implements FilterSourceConnector<F>, FilterSource<F> {
  readonly filter$ = this.dbxFilterMap.filterForKey(this.key);

  constructor(readonly dbxFilterMap: FilterMap<F>, readonly key: FilterMapKey) {}

  initWithFilter(filterObs: Observable<F>): void {
    this.dbxFilterMap.addDefaultFilterObs(this.key, filterObs);
  }

  connectWithSource(filterSource: FilterSource<F>): void {
    this.dbxFilterMap.addFilterObs(this.key, filterSource.filter$);
  }
}

class FilterMapItem<F> {
  private _source = new FilterSourceInstance<F>();

  readonly filter$ = this._source.initialFilter$;

  constructor(readonly dbxFilterMap: FilterMap<F>, readonly key: FilterMapKey) {}

  setDefaultFilterObs(obs: Maybe<ObservableOrValue<F>>): void {
    this._source.setDefaultFilter(obs);
  }

  setFilterObs(obs: Observable<F>): void {
    /**
     * MapItem uses the behavior of the DefaultFilterSource to provide a default filter value.
     */
    this._source.initWithFilter(obs);
  }

  destroy() {
    this._source.destroy();
  }
}
