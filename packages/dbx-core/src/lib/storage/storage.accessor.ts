import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';

/**
 * Stored object accessor that can get/set/remove via a key, or be cleared entirely.
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
 * LimitedStorageAccessor extension that has knowledge of all stored keys.
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
 * StorageAccessor-like object that has immediate/synchronous functionality for get/set.
 */
export abstract class InstantStorageAccessor<T> {
  abstract getNow(key: string): T | undefined;

  abstract setNow(key: string, value: T): void;

  abstract removeNow(key: string): void;
}
