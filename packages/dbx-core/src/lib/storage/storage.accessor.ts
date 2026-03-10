import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';

/**
 * Abstract storage accessor providing key-value get/set/remove operations and a clear-all method.
 *
 * All operations return observables for consistency across sync and async storage backends.
 *
 * @typeParam T - The type of values stored.
 *
 * @see {@link StorageAccessor} for extended functionality including key/value enumeration.
 */
export abstract class LimitedStorageAccessor<T> {
  /**
   * Attempts to get the value. Throws a DataDoesNotExistError if not available.
   */
  abstract get(key: string): Observable<Maybe<T>>;

  abstract set(key: string, value: Maybe<T>): Observable<void>;

  abstract remove(key: string): Observable<void>;

  abstract clear(): Observable<object>;
}

/**
 * Extended storage accessor that adds the ability to enumerate all stored keys and values,
 * optionally filtered by a key prefix.
 *
 * @typeParam T - The type of values stored.
 */
export abstract class StorageAccessor<T> extends LimitedStorageAccessor<T> {
  /**
   * Returns all values. Filtered by keys of a given prefix.
   */
  abstract all(prefix?: string): Observable<T[]>;

  /**
   * Returns all keys. Filtered by keys of a given prefix.
   */
  abstract allKeys(prefix?: string): Observable<string[]>;
}

/**
 * Synchronous storage accessor for scenarios where blocking get/set/remove is acceptable.
 *
 * @typeParam T - The type of values stored.
 */
export abstract class InstantStorageAccessor<T> {
  abstract getNow(key: string): T | undefined;

  abstract setNow(key: string, value: T): void;

  abstract removeNow(key: string): void;
}
