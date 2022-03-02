import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { timeHasExpired, unixTimeNumberForNow } from '@dereekb/date';
import { filterMaybeValuesFn, DataDoesNotExistError, DataIsExpiredError, ReadStoredData, StoredData, StoredDataStorageKey, StoredDataString, Maybe } from '@dereekb/util';
import { StorageAccessor } from './storage.accessor';

// MARK: SimpleStorageAccessor
export interface SimpleStorageAccessorConverter<T> {
  /**
   * Converts the input value to a string.
   */
  stringifyValue(value: T): StoredDataString;
  /**
   * Converts the data string into a value.
   */
  parseValue(data: StoredDataString): T;
}

/**
 * SimpleStorageAccessor delegate.
 */
export interface SimpleStorageAccessorDelegate<T> extends SimpleStorageAccessorConverter<T>, StorageAccessor<StoredDataString> {


}

export class StringifySimpleStorageAccessorConverter<T> implements SimpleStorageAccessorConverter<T> {

  stringifyValue(value: T): StoredDataString {
    return JSON.stringify(value);
  }

  parseValue(data: StoredDataString): T {
    return JSON.parse(data);
  }

}

export class WrapperSimpleStorageAccessorDelegate<T> implements SimpleStorageAccessorDelegate<T> {

  constructor(
    private _delegate: StorageAccessor<StoredDataString>,
    private _converter: SimpleStorageAccessorConverter<T>
  ) { }

  get(key: string): Observable<Maybe<StoredDataString>> {
    return this._delegate.get(key);
  }

  set(key: string, value: StoredDataString): Observable<void> {
    return this._delegate.set(key, value);
  }

  remove(key: string): Observable<void> {
    return this._delegate.remove(key);
  }

  clear(): Observable<{}> {
    return this._delegate.clear();
  }

  all(prefix?: string): Observable<string[]> {
    return this._delegate.all(prefix);
  }

  allKeys(prefix?: string): Observable<string[]> {
    return this._delegate.allKeys(prefix);
  }

  stringifyValue(value: T): StoredDataString {
    return this._converter.stringifyValue(value);
  }

  parseValue(data: StoredDataString): T {
    return this._converter.parseValue(data);
  }

}

export interface SimpleStorageAccessorConfig {
  /**
   * Storage Key Prefix
   */
  readonly prefix: string;
  /**
   * Optional prefix/value splitter.
   */
  readonly prefixSplitter?: string;
  /**
   * Number in milliseconds that objects stored will expire in.
   */
  readonly expiresIn?: number;
}

/**
 * LimitedStorageAccessor implementation that uses a Delegate
 */
export class SimpleStorageAccessor<T> implements StorageAccessor<T> {

  static readonly PREFIX_SPLITTER = '::';

  protected readonly _config: SimpleStorageAccessorConfig & {
    fullPrefix: string;
  };

  constructor(private readonly _delegate: SimpleStorageAccessorDelegate<T>, config: SimpleStorageAccessorConfig) {
    const prefix = config.prefix;
    const prefixSplitter = config.prefixSplitter ?? SimpleStorageAccessor.PREFIX_SPLITTER;

    this.assertValidStorageKeyPrefix(prefix, prefixSplitter);

    const fullPrefix = `${prefix}${prefixSplitter}`;
    this._config = {
      ...config,
      prefixSplitter,
      fullPrefix
    };
  }

  // MARK: LimitedStorageAccessor
  get(inputKey: string): Observable<T> {
    const storeKey = this.makeStorageKey(inputKey);
    return this._delegate.get(storeKey).pipe(
      map((storedData: Maybe<string>) => {
        if (storedData) {
          const readStoredData = this.readStoredData(storedData);

          if (!readStoredData.expired) {
            return readStoredData.convertedData;
          } else {
            throw new DataIsExpiredError<T>(readStoredData);
          }
        } else {
          throw new DataDoesNotExistError();
        }
      })
    );
  }

  set(inputKey: string, inputValue: T): Observable<void> {
    const storeKey = this.makeStorageKey(inputKey);
    const storeData: StoredData = this.buildStoredData(inputValue);
    const data = JSON.stringify(storeData);
    return this._delegate.set(storeKey, data);
  }

  remove(key: string): Observable<void> {
    const storeKey = this.makeStorageKey(key);
    return this._delegate.remove(storeKey);
  }

  all(): Observable<T[]> {
    return this._delegate.all(this._config.fullPrefix).pipe(
      map((allStoredData) => {
        return allStoredData.map((storedData) => {
          const readStoredData = this.readStoredData(storedData);

          if (!readStoredData.expired) {
            return readStoredData.convertedData;
          } else {
            return null;
          }
        }).filter(filterMaybeValuesFn)
      })
    );
  }

  allKeys(): Observable<string[]> {
    return this._delegate.allKeys(this._config.fullPrefix).pipe(
      map((keys) => keys.map(x => this.decodeStorageKey(x)))
    );
  }

  clear(): Observable<{}> {
    return this._delegate.clear();
  }

  // MARK: Stored Values
  protected readStoredData(storedDataString: StoredDataString): ReadStoredData<T> {
    const storedData: StoredData = JSON.parse(storedDataString);
    const expired = this.isExpiredStoredData(storedData);
    const convertedData = this._delegate.parseValue(storedData.data);

    return {
      ...storedData,
      expired,
      convertedData
    };
  }

  protected buildStoredData(value: T): StoredData {
    return {
      storedAt: unixTimeNumberForNow(),
      data: this.stringifyValue(value)
    };
  }

  protected isExpiredStoredData(storeData: StoredData): boolean {
    const expiresIn = this._config.expiresIn;
    if (expiresIn) {
      if (storeData.storedAt) {
        return timeHasExpired(storeData.storedAt, expiresIn);
      }

      return true;
    } else {
      return false;
    }
  }

  // MARK: Internal
  protected assertValidStorageKeyPrefix(prefix: string, prefixSplitter: string): void {
    if (!prefixSplitter) {
      throw new Error('Invalid storage key prefix splitter. Must be defined and not empty.');
    }

    if (!this.isValidStorageKeyPrefix(prefix, prefixSplitter)) {
      throw new Error('Invalid storage key prefix.');
    }
  }

  protected isValidStorageKeyPrefix(prefix: string, prefixSpltter: string): boolean {
    return Boolean(prefix && prefix.indexOf(prefixSpltter) === -1);
  }

  protected makeStorageKey(key: string): StoredDataStorageKey {
    return `${this._config.prefix}${this._config.prefixSplitter}${String(key)}`;
  }

  protected isKeyOfAccessor(storageKey: StoredDataStorageKey): boolean {
    return storageKey.startsWith(this._config.fullPrefix);
  }

  protected decodeStorageKey(storageKey: StoredDataStorageKey): string {
    const split = storageKey.split(this._config.prefixSplitter!, 2);
    return split[1];
  }

  protected stringifyValue(value: T): string {
    return this._delegate.stringifyValue(value);
  }

}
