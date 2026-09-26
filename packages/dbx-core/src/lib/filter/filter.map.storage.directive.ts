import { Directive, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { asObservable, distinctUntilObjectValuesChanged, filterMaybe, type FilterJsonConverter, FilterMap, type FilterMapKey, type ObservableOrValue } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { distinctUntilChanged, filter, first, map, of, shareReplay, skip, switchMap, tap, type Observable } from 'rxjs';
import { cleanSubscription } from '../rxjs/subscription';
import { type DbxFilterStorageKey, DbxFilterStorageService } from './filter.storage.service';

/**
 * Configuration for {@link DbxFilterMapStorageDirective}.
 *
 * @typeParam F - The filter type.
 * @typeParam J - The JSON-safe value the filter is saved as.
 */
export interface DbxFilterMapStorageConfig<F, J = unknown> {
  /**
   * Filter map key to load into and save from.
   */
  readonly key: FilterMapKey;
  /**
   * Key the filter is saved under in storage. Defaults to the filter map key.
   */
  readonly storageKey?: Maybe<DbxFilterStorageKey>;
  /**
   * Filter to use when nothing has been saved yet, and when the filter is reset.
   */
  readonly defaultFilter?: Maybe<ObservableOrValue<F>>;
  /**
   * Maps a loaded filter before it is used, e.g. to refresh preset values that depend on the current date.
   *
   * Return null/undefined to discard the saved filter and use the default filter instead.
   */
  readonly mapLoadedFilter?: Maybe<(filter: F) => Maybe<F>>;
  /**
   * Converts the filter to and from the JSON value that is saved.
   *
   * Required for filters that JSON cannot represent, such as filters with Date or Set fields. Without a converter the filter is saved as-is.
   */
  readonly jsonConverter?: Maybe<FilterJsonConverter<F, J>>;
}

/**
 * Saves the filter of a keyed entry in an ancestor {@link FilterMap} to storage (localStorage by default), and loads it again when the page loads. The saved filter becomes the key's default filter, and every later change to the key is saved.
 *
 * Use {@link reset} to set the key back to its default filter and remove the saved filter.
 *
 * Requires {@link provideDbxFilterStorage}.
 *
 * @dbxFilter
 * @dbxFilterSlug map-storage
 * @dbxFilterRelated map, map-source-connector, map-merge-source
 * @dbxFilterSkillRefs dbx__ref__dbx-component-patterns
 *
 * @example
 * ```html
 * <div dbxFilterMap>
 *   <my-filter-button [dbxFilterMapSourceConnector]="'list'" [dbxFilterMapStorage]="{ key: 'list', storageKey: 'my.list.filter', defaultFilter: {} }"></my-filter-button>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterMapStorage]',
  exportAs: 'dbxFilterMapStorage'
})
export class DbxFilterMapStorageDirective<F, J = unknown> {
  readonly dbxFilterMap = inject(FilterMap<F>);
  readonly dbxFilterStorageService = inject(DbxFilterStorageService);

  /**
   * The key to save and how to save it.
   */
  readonly dbxFilterMapStorage = input<Maybe<DbxFilterMapStorageConfig<F, J>>>();

  readonly config$ = toObservable(this.dbxFilterMapStorage).pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  /**
   * Set while reset() sets the key back to the default filter, so the default filter is not saved.
   */
  private _resetting = false;

  constructor() {
    cleanSubscription(this.config$.pipe(switchMap((config) => this._loadAndSaveFilter(config))).subscribe());
  }

  /**
   * Sets the key back to the default filter and removes the saved filter.
   *
   * The default filter is not saved, so the next page load also starts from the default filter.
   *
   * @returns Observable that emits once the key is reset and the saved filter is removed.
   */
  reset(): Observable<void> {
    return this.config$.pipe(
      first(),
      switchMap((config) =>
        asObservable(config.defaultFilter).pipe(
          first(),
          tap((defaultFilter) => {
            if (defaultFilter != null) {
              this._resetting = true;
              this.dbxFilterMap.setFilterForKey(config.key, defaultFilter);
              this._resetting = false;
            }
          }),
          switchMap(() => this.dbxFilterStorageService.clearFilter(storageKeyForConfig(config)))
        )
      )
    );
  }

  /**
   * Loads the saved filter as the key's default filter, then returns an observable that saves every later change to the key.
   *
   * @param config - The key to save and how to save it.
   * @returns Observable that saves the key's filter while subscribed.
   */
  private _loadAndSaveFilter(config: DbxFilterMapStorageConfig<F, J>): Observable<void> {
    const { key, defaultFilter, mapLoadedFilter, jsonConverter } = config;
    const storageKey = storageKeyForConfig(config);

    const loadedFilter$: Observable<F> = this.dbxFilterStorageService.loadFilter<F, J>(storageKey, jsonConverter).pipe(
      map((savedFilter) => (savedFilter != null && mapLoadedFilter ? mapLoadedFilter(savedFilter) : savedFilter)),
      switchMap((savedFilter) => (savedFilter == null ? asObservable(defaultFilter) : of(savedFilter))),
      filterMaybe()
    );

    this.dbxFilterMap.addDefaultFilterObs(key, loadedFilter$);

    return this.dbxFilterMap.filterForKey(key).pipe(
      distinctUntilObjectValuesChanged(),
      skip(1), // the first value is the loaded/default filter
      filter(() => !this._resetting),
      switchMap((nextFilter) => this.dbxFilterStorageService.saveFilter(storageKey, nextFilter, jsonConverter))
    );
  }
}

function storageKeyForConfig(config: Pick<DbxFilterMapStorageConfig<unknown>, 'key' | 'storageKey'>): DbxFilterStorageKey {
  return config.storageKey ?? config.key;
}
