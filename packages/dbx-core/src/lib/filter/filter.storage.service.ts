import { Injectable, InjectionToken, inject } from '@angular/core';
import { type FilterJsonConverter } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { catchError, map, of, type Observable } from 'rxjs';
import { type StorageAccessor } from '../storage/storage.accessor';
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
 * Saves and loads filters to storage (localStorage by default, via {@link SimpleStorageAccessorFactory}).
 *
 * Filters are saved as JSON. Filters with fields that JSON cannot represent, such as Date or Set fields, pass a {@link FilterJsonConverter}.
 *
 * To save and load the filter of a {@link FilterMap} key, use the {@link DbxFilterMapStorageDirective} in the template instead of calling this service directly.
 *
 * Provided by {@link provideDbxFilterStorage}, which requires {@link provideDbxStorage}.
 */
@Injectable()
export class DbxFilterStorageService {
  readonly storageAccessorFactory = inject(SimpleStorageAccessorFactory);
  readonly config = inject(DBX_FILTER_STORAGE_SERVICE_CONFIG_TOKEN, { optional: true });

  readonly prefix = this.config?.prefix ?? DEFAULT_DBX_FILTER_STORAGE_PREFIX;

  readonly storageAccessor: StorageAccessor<unknown> = this.storageAccessorFactory.createStorageAccessor<unknown>({
    prefix: this.prefix
  });

  /**
   * Loads the saved filter for the given storage key.
   *
   * @param storageKey - Key the filter was saved under.
   * @param jsonConverter - Converts the saved JSON value back to the filter. Without one, the saved value is returned as-is.
   * @returns Observable of the saved filter, or undefined if nothing is saved or the saved value cannot be read.
   */
  loadFilter<F, J = unknown>(storageKey: DbxFilterStorageKey, jsonConverter?: Maybe<FilterJsonConverter<F, J>>): Observable<Maybe<F>> {
    return this.storageAccessor.get(storageKey).pipe(
      map((json) => {
        let result: Maybe<F>;

        if (json != null) {
          result = jsonConverter ? jsonConverter.fromJson(json as J) : (json as F);
        }

        return result;
      }),
      catchError(() => of(undefined))
    );
  }

  /**
   * Saves the filter under the given storage key.
   *
   * @param storageKey - Key to save the filter under.
   * @param filter - Filter to save.
   * @param jsonConverter - Converts the filter to the JSON value that is saved. Without one, the filter is saved as-is.
   * @returns Observable that emits once the filter is saved.
   */
  saveFilter<F, J = unknown>(storageKey: DbxFilterStorageKey, filter: F, jsonConverter?: Maybe<FilterJsonConverter<F, J>>): Observable<void> {
    return this.storageAccessor.set(storageKey, jsonConverter ? jsonConverter.toJson(filter) : filter);
  }

  /**
   * Removes the saved filter for the given storage key.
   *
   * @param storageKey - Key the filter was saved under.
   * @returns Observable that emits once the filter is removed.
   */
  clearFilter(storageKey: DbxFilterStorageKey): Observable<void> {
    return this.storageAccessor.remove(storageKey);
  }
}
