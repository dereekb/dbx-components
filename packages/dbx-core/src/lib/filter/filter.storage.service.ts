import { Injectable, InjectionToken, inject } from '@angular/core';
import { asObservable, distinctUntilObjectValuesChanged, filterMaybe, type FilterMap, type FilterMapKey, type ObservableOrValue } from '@dereekb/rxjs';
import { type Destroyable, type Maybe } from '@dereekb/util';
import { catchError, filter, first, map, of, skip, switchMap, tap, type Observable } from 'rxjs';
import { type StorageAccessor } from '../storage/storage.accessor';
import { type SimpleStorageAccessorConverter, StringifyWithDatesSimpleStorageAccessorConverter } from '../storage/storage.accessor.simple';
import { SimpleStorageAccessorFactory } from '../storage/storage.accessor.simple.factory';

/**
 * Key a filter is saved under in storage.
 */
export type DbxFilterStorageKey = string;

/**
 * Default storage key prefix used by {@link DbxFilterStorageService}.
 */
export const DEFAULT_DBX_FILTER_STORAGE_PREFIX = 'dbxf';

/**
 * Configuration for {@link DbxFilterStorageService}.
 */
export interface DbxFilterStorageServiceConfig {
  /**
   * Storage key prefix that namespaces all saved filters.
   *
   * Defaults to {@link DEFAULT_DBX_FILTER_STORAGE_PREFIX}.
   */
  readonly prefix?: Maybe<string>;
}

/**
 * Optional injection token for the {@link DbxFilterStorageServiceConfig}.
 */
export const DBX_FILTER_STORAGE_SERVICE_CONFIG_TOKEN = new InjectionToken<DbxFilterStorageServiceConfig>('DbxFilterStorageServiceConfig');

/**
 * Configuration for {@link DbxFilterStorageService.persistFilterMapKey}.
 *
 * @typeParam F - The filter type.
 */
export interface DbxFilterStoragePersistFilterMapKeyConfig<F> {
  /**
   * Filter map that holds the key.
   */
  readonly filterMap: FilterMap<F>;
  /**
   * Filter map key to load into and save from.
   */
  readonly key: FilterMapKey;
  /**
   * Key the filter is saved under in storage. Defaults to the filter map key.
   */
  readonly storageKey?: Maybe<DbxFilterStorageKey>;
  /**
   * Filter to use when nothing has been saved yet.
   */
  readonly defaultFilter?: Maybe<ObservableOrValue<F>>;
  /**
   * Maps a loaded filter before it is used, e.g. to refresh preset values that depend on the current date.
   *
   * Return null/undefined to discard the saved filter and use the default filter instead.
   */
  readonly mapLoadedFilter?: Maybe<(filter: F) => Maybe<F>>;
  /**
   * Converter used to save and load the filter. Defaults to a JSON converter that revives Date values.
   *
   * Provide a custom converter for filters that JSON cannot represent, such as filters that contain a Set.
   */
  readonly converter?: Maybe<SimpleStorageAccessorConverter<F>>;
}

/**
 * A {@link FilterMap} key whose filter is saved by {@link DbxFilterStorageService.persistFilterMapKey}.
 *
 * Destroy it to stop saving changes.
 *
 * @typeParam F - The filter type.
 */
export interface DbxFilterStoragePersistedFilterMapKey<F> extends Destroyable {
  /**
   * Filter map that holds the key.
   */
  readonly filterMap: FilterMap<F>;
  /**
   * Filter map key being saved.
   */
  readonly key: FilterMapKey;
  /**
   * Key the filter is saved under in storage.
   */
  readonly storageKey: DbxFilterStorageKey;
  /**
   * Sets the key back to the default filter and removes the saved filter.
   *
   * The default filter is not saved, so the next page load also starts from the default filter.
   *
   * @returns Observable that emits once the key is reset and the saved filter is removed.
   */
  reset(): Observable<void>;
}

/**
 * Saves and loads filters to storage (localStorage by default, via {@link SimpleStorageAccessorFactory}).
 *
 * Use {@link persistFilterMapKey} to have a {@link FilterMap} key start from its saved filter and save every change.
 *
 * Provided by {@link provideDbxFilterStorage}, which requires {@link provideDbxStorage}.
 *
 * @example
 * ```ts
 * readonly filterMap = inject(FilterMap<MyFilter>);
 * readonly dbxFilterStorageService = inject(DbxFilterStorageService);
 *
 * readonly listFilterStorage = clean(this.dbxFilterStorageService.persistFilterMapKey({ filterMap: this.filterMap, key: 'list', defaultFilter: {} }));
 *
 * clearFilters() {
 *   this.listFilterStorage.reset().subscribe();
 * }
 * ```
 */
@Injectable()
export class DbxFilterStorageService {
  readonly storageAccessorFactory = inject(SimpleStorageAccessorFactory);
  readonly config = inject(DBX_FILTER_STORAGE_SERVICE_CONFIG_TOKEN, { optional: true });

  readonly prefix = this.config?.prefix ?? DEFAULT_DBX_FILTER_STORAGE_PREFIX;

  readonly defaultStorageAccessor: StorageAccessor<unknown> = this.storageAccessorFactory.createStorageAccessor<unknown>({
    prefix: this.prefix,
    converter: new StringifyWithDatesSimpleStorageAccessorConverter<unknown>()
  });

  /**
   * Loads the saved filter for the given storage key.
   *
   * @param storageKey - Key the filter was saved under.
   * @param converter - Optional converter to parse the filter with.
   * @returns Observable of the saved filter, or undefined if nothing is saved or the saved data cannot be read.
   */
  loadFilter<F>(storageKey: DbxFilterStorageKey, converter?: Maybe<SimpleStorageAccessorConverter<F>>): Observable<Maybe<F>> {
    return this.storageAccessorForConverter(converter)
      .get(storageKey)
      .pipe(catchError(() => of(undefined)));
  }

  /**
   * Saves the filter under the given storage key.
   *
   * @param storageKey - Key to save the filter under.
   * @param filter - Filter to save.
   * @param converter - Optional converter to stringify the filter with.
   * @returns Observable that emits once the filter is saved.
   */
  saveFilter<F>(storageKey: DbxFilterStorageKey, filter: F, converter?: Maybe<SimpleStorageAccessorConverter<F>>): Observable<void> {
    return this.storageAccessorForConverter(converter).set(storageKey, filter);
  }

  /**
   * Removes the saved filter for the given storage key.
   *
   * @param storageKey - Key the filter was saved under.
   * @returns Observable that emits once the filter is removed.
   */
  clearFilter(storageKey: DbxFilterStorageKey): Observable<void> {
    return this.defaultStorageAccessor.remove(storageKey);
  }

  /**
   * Loads the saved filter into a {@link FilterMap} key as its default filter, then saves every later change to that key.
   *
   * The key falls back to the configured default filter when nothing is saved yet.
   *
   * @param config - Filter map key and storage configuration.
   * @returns The persisted key. Call reset() to go back to the default filter, and destroy() to stop saving changes.
   */
  persistFilterMapKey<F>(config: DbxFilterStoragePersistFilterMapKeyConfig<F>): DbxFilterStoragePersistedFilterMapKey<F> {
    const { filterMap, key, defaultFilter, mapLoadedFilter, converter } = config;
    const storageKey = config.storageKey ?? key;

    const initialFilter$: Observable<F> = this.loadFilter<F>(storageKey, converter).pipe(
      map((savedFilter) => (savedFilter != null && mapLoadedFilter ? mapLoadedFilter(savedFilter) : savedFilter)),
      switchMap((savedFilter) => (savedFilter == null ? asObservable(defaultFilter) : of(savedFilter))),
      filterMaybe()
    );

    filterMap.addDefaultFilterObs(key, initialFilter$);

    // set while reset() writes the default filter to the key, so the default filter is not saved
    let resetting = false;

    const saveSubscription = filterMap
      .filterForKey(key)
      .pipe(
        distinctUntilObjectValuesChanged(),
        skip(1), // the first value is the loaded/default filter
        filter(() => !resetting),
        switchMap((nextFilter) => this.saveFilter(storageKey, nextFilter, converter))
      )
      .subscribe();

    const reset = () =>
      asObservable(defaultFilter).pipe(
        first(),
        tap((resetFilter) => {
          if (resetFilter != null) {
            resetting = true;
            filterMap.setFilterForKey(key, resetFilter);
            resetting = false;
          }
        }),
        switchMap(() => this.clearFilter(storageKey))
      );

    return {
      filterMap,
      key,
      storageKey,
      reset,
      destroy: () => saveSubscription.unsubscribe()
    };
  }

  protected storageAccessorForConverter<F>(converter?: Maybe<SimpleStorageAccessorConverter<F>>): StorageAccessor<F> {
    return (converter ? this.storageAccessorFactory.createStorageAccessor<F>({ prefix: this.prefix, converter }) : this.defaultStorageAccessor) as StorageAccessor<F>;
  }
}
