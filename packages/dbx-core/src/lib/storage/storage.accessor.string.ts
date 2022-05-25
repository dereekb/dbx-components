import { filterMaybeValues, StoredDataString, FullStorageObject, StorageObjectUtility, Maybe } from '@dereekb/util';
import { Observable, map, shareReplay } from 'rxjs';
import { StorageAccessor } from './storage.accessor';

/**
 * Simple StorageAccessor implementation that wraps a FullStorageObject.
 */
export class StringStorageAccessor implements StorageAccessor<StoredDataString> {

  constructor(private readonly _storage: FullStorageObject) { }

  get(key: string): Observable<Maybe<StoredDataString>> {
    return new Observable((x) => {
      const value = this._storage.getItem(key);
      x.next(value);
      x.complete();
    });
  }

  set(key: string, value: StoredDataString): Observable<void> {
    return new Observable<void>((x) => {
      this._storage.setItem(key, value);
      x.next();
      x.complete();
    });
  }

  remove(key: string): Observable<void> {
    return new Observable<void>((x) => {
      this._storage.removeItem(key);
      x.next();
      x.complete();
    });
  }

  clear(): Observable<StoredDataString[]> {
    const removed = this._storage.removeAll();
    return new Observable((x) => {
      x.next(removed);
      x.complete();
    });
  }

  all(): Observable<StoredDataString[]> {
    return this.allKeys().pipe(
      map(x => filterMaybeValues(x.map(y => this._storage.getItem(y)))),
      shareReplay(1)
    );
  }

  allKeys(): Observable<string[]> {
    return new Observable((x) => {
      const result = StorageObjectUtility.allKeysFromStorageObject(this._storage);
      x.next(result);
      x.complete();
    });
  }

}
