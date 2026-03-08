import { filterMaybe } from '../rxjs/value';
import { type ObservableOrValue } from '../rxjs/getter';
import { FilterSourceInstance } from './filter.source';
import { BehaviorSubject, type Observable, switchMap, map, distinctUntilChanged, shareReplay, first, merge, type Subscription, finalize } from 'rxjs';
import { type FilterSource, type FilterSourceConnector } from './filter';
import { type Destroyable, type IndexNumber, type IndexRef, type Maybe } from '@dereekb/util';

/**
 * String key used to identify a specific filter entry within a {@link FilterMap}.
 */
export type FilterMapKey = string;

/**
 * Manages a collection of reactive filters keyed by string identifiers.
 *
 * Multiple filter observables can be registered under the same key and their emissions are merged.
 * Supports default filters that are used when no explicit filter is set.
 *
 * @example
 * ```ts
 * const filterMap = new FilterMap<{ active: boolean }>();
 *
 * // Register a filter observable under a key
 * filterMap.addFilterObs('users', of({ active: true }));
 *
 * // Subscribe to the filter for that key
 * filterMap.filterForKey('users').subscribe(f => console.log(f));
 * // Output: { active: true }
 * ```
 */
export class FilterMap<F> implements Destroyable {
  private readonly _map = new BehaviorSubject<Map<FilterMapKey, FilterMapItem<F>>>(new Map());

  /**
   * Returns an observable of the filter value for the given key.
   *
   * Waits until a filter entry exists for the key, then switches to its filter stream.
   *
   * @param key - filter map key to observe
   * @returns observable that emits the current filter value for the key
   */
  filterForKey(key: FilterMapKey): Observable<F> {
    return this._map.pipe(
      map((x) => x.get(key)),
      filterMaybe(),
      first(), // take first since the item never changes.
      switchMap((x) => x.filter$),
      filterMaybe()
    );
  }

  /**
   * Sets a default filter observable for the given key, used as a fallback when no explicit filter is set.
   *
   * @param key - filter map key
   * @param obs - default filter observable or value
   */
  addDefaultFilterObs(key: FilterMapKey, obs: Maybe<ObservableOrValue<F>>): void {
    this._itemForKey(key).setDefaultFilterObs(obs);
  }

  /**
   * Adds a filter observable for the given key. Multiple observables can be added per key
   * and their emissions are merged together.
   *
   * @param key - filter map key
   * @param obs - filter observable to add
   */
  addFilterObs(key: FilterMapKey, obs: Observable<F>): void {
    this._itemForKey(key).addFilterObs(obs);
  }

  /**
   * Creates a {@link FilterMapKeyInstance} bound to the given key, providing both
   * {@link FilterSource} and {@link FilterSourceConnector} interfaces for that key.
   *
   * @param key - filter map key to bind
   * @returns instance for interacting with the filter at the given key
   */
  makeInstance(key: FilterMapKey): FilterMapKeyInstance<F> {
    return new FilterMapKeyInstance<F>(this, key);
  }

  /**
   * Creates an observable that emits a new {@link FilterMapKeyInstance} each time the key changes.
   *
   * @param keyObs - observable of filter map keys
   * @returns observable that emits instances for the current key
   */
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

  /**
   * Destroys all filter items and completes the internal subject.
   */
  destroy(): void {
    this._map.value.forEach((x) => x.destroy());
    this._map.complete();
  }
}

/**
 * Bound instance of a {@link FilterMap} for a specific key.
 *
 * Implements both {@link FilterSource} (provides filter values) and {@link FilterSourceConnector}
 * (accepts filter sources) for a single filter map entry.
 */
export class FilterMapKeyInstance<F> implements FilterSourceConnector<F>, FilterSource<F> {
  private readonly _dbxFilterMap: FilterMap<F>;
  private readonly _key: FilterMapKey;

  /**
   * Observable of the filter value for this instance's key.
   */
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

  /**
   * Sets the default filter observable for this key.
   */
  initWithFilter(filterObs: Observable<F>): void {
    this.dbxFilterMap.addDefaultFilterObs(this.key, filterObs);
  }

  /**
   * Connects a filter source, adding its filter observable to this key's merged filters.
   */
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
      const i = this._i;
      this._i += 1;

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
