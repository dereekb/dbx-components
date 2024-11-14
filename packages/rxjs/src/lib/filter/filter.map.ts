import { filterMaybe } from '../rxjs/value';
import { type ObservableOrValue } from '../rxjs/getter';
import { FilterSourceInstance } from './filter.source';
import { BehaviorSubject, type Observable, switchMap, map, distinctUntilChanged, shareReplay, first, merge, type Subscription, finalize } from 'rxjs';
import { type FilterSource, type FilterSourceConnector } from './filter';
import { type Destroyable, type IndexNumber, type IndexRef, type Maybe } from '@dereekb/util';

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
    this._itemForKey(key).addFilterObs(obs);
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
  private readonly _dbxFilterMap: FilterMap<F>;
  private readonly _key: FilterMapKey;

  readonly filter$: Observable<F>;

  constructor(dbxFilterMap: FilterMap<F>, key: FilterMapKey) {
    this._dbxFilterMap = dbxFilterMap;
    this._key = key;
    this.filter$ = this._dbxFilterMap.filterForKey(this._key);
  }

  get dbxFilterMap(): FilterMap<F> {
    return this._dbxFilterMap;
  }

  get key(): FilterMapKey {
    return this._key;
  }

  initWithFilter(filterObs: Observable<F>): void {
    this.dbxFilterMap.addDefaultFilterObs(this.key, filterObs);
  }

  connectWithSource(filterSource: FilterSource<F>): void {
    this.dbxFilterMap.addFilterObs(this.key, filterSource.filter$);
  }
}

interface FilterMapItemObs<F> extends IndexRef {
  readonly obs: Observable<F>;
  readonly deleteOnComplete: Subscription;
}

class FilterMapItem<F> {
  private readonly _dbxFilterMap: FilterMap<F>;
  private readonly _key: FilterMapKey;

  private _i = 0;
  private readonly _source = new FilterSourceInstance<F>();
  private readonly _obs = new BehaviorSubject<FilterMapItemObs<F>[]>([]);

  private readonly _obs$: Observable<F> = this._obs.pipe(
    switchMap((x) => merge(...x.map((y) => y.obs))),
    distinctUntilChanged()
  );

  readonly filter$ = this._source.initialFilter$;

  constructor(dbxFilterMap: FilterMap<F>, key: FilterMapKey) {
    this._dbxFilterMap = dbxFilterMap;
    this._key = key;
  }

  get dbxFilterMap(): FilterMap<F> {
    return this._dbxFilterMap;
  }

  get key(): FilterMapKey {
    return this._key;
  }

  setDefaultFilterObs(obs: Maybe<ObservableOrValue<F>>): void {
    this._source.setDefaultFilter(obs);
  }

  addFilterObs(obs: Observable<F>): void {
    const currentObs = this._obs.value;
    const existingObsItem = currentObs.find((x) => x.obs === obs);

    if (!existingObsItem) {
      const i = this._i++;

      const deleteOnComplete = obs
        .pipe(
          finalize(() => {
            this._deleteFilterObs(i);
          })
        )
        .subscribe();

      const nextObs = [...currentObs, { i, obs, deleteOnComplete }];
      this._obs.next(nextObs);

      if (i === 0) {
        /**
         * MapItem uses the behavior of the DefaultFilterSource to provide a default filter value.
         */
        this._source.initWithFilter(this._obs$);
      }
    }
  }

  private _deleteFilterObs(index: IndexNumber) {
    const currentObs = this._obs.value;
    const obsToRetain = currentObs.filter((x) => x.i !== index);

    if (obsToRetain.length !== currentObs.length) {
      this._obs.next(this._obs.value);
    }
  }

  destroy() {
    this._obs.value.forEach((x) => x.deleteOnComplete.unsubscribe());
    this._source.destroy();
    this._obs.complete();
  }
}
