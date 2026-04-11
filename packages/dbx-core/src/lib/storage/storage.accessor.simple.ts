import { type Observable, map } from 'rxjs';
import { isThrottled, unixDateTimeSecondsNumberForNow, DataDoesNotExistError, DataIsExpiredError, type ReadStoredData, type StoredData, type StoredDataStorageKey, type StoredDataString, type Maybe, type Milliseconds, hasNonNullValue, splitJoinRemainder } from '@dereekb/util';
import { type StorageAccessor } from './storage.accessor';

// MARK: SimpleStorageAccessor
/**
 * Strategy for converting values to and from their stored string representation.
 *
 * @typeParam T - The type of value being converted.
 */
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
 * Combined interface providing both value conversion and raw string storage capabilities.
 * Used as the backing delegate for {@link SimpleStorageAccessor}.
 *
 * @typeParam T - The type of value being stored.
 */
export interface SimpleStorageAccessorDelegate<T> extends SimpleStorageAccessorConverter<T>, StorageAccessor<StoredDataString> {}

/**
 * Default {@link SimpleStorageAccessorConverter} that uses `JSON.stringify`/`JSON.parse` for conversion.
 *
 * @typeParam T - The type of value being converted.
 */
export class StringifySimpleStorageAccessorConverter<T> implements SimpleStorageAccessorConverter<T> {
  stringifyValue(value: T): StoredDataString {
    return JSON.stringify(value);
  }

  parseValue(data: StoredDataString): T {
    return JSON.parse(data);
  }
}

/**
 * Composes a {@link StorageAccessor} and a {@link SimpleStorageAccessorConverter} into a single
 * {@link SimpleStorageAccessorDelegate} implementation.
 *
 * @typeParam T - The type of value being stored.
 */
export class WrapperSimpleStorageAccessorDelegate<T> implements SimpleStorageAccessorDelegate<T> {
  private readonly _delegate: StorageAccessor<StoredDataString>;
  private readonly _converter: SimpleStorageAccessorConverter<T>;

  constructor(delegate: StorageAccessor<StoredDataString>, converter: SimpleStorageAccessorConverter<T>) {
    this._delegate = delegate;
    this._converter = converter;
  }

  get(key: string): Observable<Maybe<StoredDataString>> {
    return this._delegate.get(key);
  }

  set(key: string, value: StoredDataString): Observable<void> {
    return this._delegate.set(key, value);
  }

  remove(key: string): Observable<void> {
    return this._delegate.remove(key);
  }

  clear(): Observable<object> {
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

/**
 * Configuration for a {@link SimpleStorageAccessor}, controlling key namespacing and expiration.
 *
 * @example
 * ```typescript
 * const config: SimpleStorageAccessorConfig = {
 *   prefix: 'myapp_settings',
 *   expiresIn: 24 * 60 * 60 * 1000, // 24 hours
 * };
 * ```
 */
export interface SimpleStorageAccessorConfig {
  /**
   * Prefix prepended to all storage keys to namespace entries.
   */
  readonly prefix: string;
  /**
   * Separator between the prefix and the key. Defaults to `'::'`.
   */
  readonly prefixSplitter?: string;
  /**
   * Time in milliseconds after which stored data is considered expired.
   */
  readonly expiresIn?: Milliseconds;
}

interface ConfiguredSimpleStorageAccessorConfig extends SimpleStorageAccessorConfig {
  readonly prefixSplitter: string;
  readonly fullPrefix: string;
}

/**
 * Validates that a storage key prefix is non-empty and does not contain the prefix splitter character.
 *
 * @param prefix - The prefix string to validate.
 * @param prefixSplitter - The splitter string that separates the prefix from the key.
 * @throws {Error} If the prefix is invalid or the splitter is empty.
 */
export function assertValidStorageKeyPrefix(prefix: string, prefixSplitter: string): void {
  if (!prefixSplitter) {
    throw new Error('Invalid storage key prefix splitter. Must be defined and not empty.'); // TODO(FUTURE): Consider changing to a concrete error type
  }

  if (!isValidStorageKeyPrefix(prefix, prefixSplitter)) {
    throw new Error('Invalid storage key prefix.');
  }
}

/**
 * Checks whether a storage key prefix is valid (non-empty and does not contain the splitter).
 *
 * @param prefix - The prefix string to validate.
 * @param prefixSpltter - The splitter string that separates the prefix from the key.
 * @returns `true` if the prefix is valid.
 */
export function isValidStorageKeyPrefix(prefix: string, prefixSpltter: string): boolean {
  return Boolean(prefix?.indexOf(prefixSpltter) === -1);
}

/**
 * Full-featured {@link StorageAccessor} that adds key namespacing, JSON serialization,
 * and optional time-based expiration on top of a raw string storage backend.
 *
 * Values are stored as JSON with metadata (timestamp) and automatically checked
 * for expiration on read.
 *
 * @typeParam T - The type of values stored.
 *
 * @throws {DataDoesNotExistError} When reading a key that does not exist.
 * @throws {DataIsExpiredError} When reading a key whose stored data has expired.
 *
 * @example
 * ```typescript
 * const accessor = factory.createStorageAccessor<UserSettings>({
 *   prefix: 'user_prefs',
 *   expiresIn: 3600000,
 * });
 *
 * accessor.set('theme', { dark: true }).subscribe();
 * accessor.get('theme').subscribe(settings => console.log(settings));
 * ```
 */
export class SimpleStorageAccessor<T> implements StorageAccessor<T> {
  static readonly PREFIX_SPLITTER = '::';

  private readonly _delegate: SimpleStorageAccessorDelegate<T>;
  protected readonly _config: ConfiguredSimpleStorageAccessorConfig;

  constructor(delegate: SimpleStorageAccessorDelegate<T>, config: SimpleStorageAccessorConfig) {
    const prefix = config.prefix;
    const prefixSplitter = config.prefixSplitter ?? SimpleStorageAccessor.PREFIX_SPLITTER;

    assertValidStorageKeyPrefix(prefix, prefixSplitter);

    const fullPrefix = `${prefix}${prefixSplitter}`;

    this._delegate = delegate;
    this._config = {
      ...config,
      prefixSplitter,
      fullPrefix
    };
  }

  get delegate() {
    return this._delegate;
  }

  get config() {
    return this._config;
  }

  // MARK: LimitedStorageAccessor
  get(inputKey: string): Observable<T> {
    const storeKey = this.makeStorageKey(inputKey);
    return this._delegate.get(storeKey).pipe(
      map((storedData: Maybe<string>) => {
        let result: T;

        if (storedData) {
          const readStoredData = this.readStoredData(storedData);

          if (!readStoredData.expired) {
            result = readStoredData.convertedData;
          } else {
            throw new DataIsExpiredError<T>(readStoredData);
          }
        } else {
          throw new DataDoesNotExistError();
        }

        return result;
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
        return allStoredData
          .map((storedData) => {
            const readStoredData = this.readStoredData(storedData);
            const result = !readStoredData.expired ? readStoredData.convertedData : null;
            return result;
          })
          .filter(hasNonNullValue);
      })
    );
  }

  allKeys(): Observable<string[]> {
    return this._delegate.allKeys(this._config.fullPrefix).pipe(map((keys) => keys.map((x) => this.decodeStorageKey(x))));
  }

  clear(): Observable<object> {
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
      storedAt: unixDateTimeSecondsNumberForNow(),
      data: this.stringifyValue(value)
    };
  }

  protected isExpiredStoredData(storeData: StoredData): boolean {
    const expiresIn = this._config.expiresIn;
    let result: boolean;

    if (expiresIn) {
      if (storeData.storedAt) {
        result = isThrottled(expiresIn, storeData.storedAt);
      } else {
        result = true;
      }
    } else {
      result = false;
    }

    return result;
  }

  // MARK: Internal
  protected makeStorageKey(key: string): StoredDataStorageKey {
    return `${this._config.prefix}${this._config.prefixSplitter}${String(key)}`;
  }

  protected isKeyOfAccessor(storageKey: StoredDataStorageKey): boolean {
    return storageKey.startsWith(this._config.fullPrefix);
  }

  protected decodeStorageKey(storageKey: StoredDataStorageKey): string {
    const split = splitJoinRemainder(storageKey, this._config.prefixSplitter, 2);
    return split[1];
  }

  protected stringifyValue(value: T): string {
    return this._delegate.stringifyValue(value);
  }
}
