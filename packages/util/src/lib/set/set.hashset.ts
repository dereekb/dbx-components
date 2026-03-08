import { type PrimativeKey, type ReadKeyFunction } from '../key';
import { type Maybe } from '../value/maybe.type';

/**
 * Configuration for a {@link HashSet}, providing the key extraction function.
 */
export interface HashSetConfig<K extends PrimativeKey, T> {
  /** Extracts the unique key used for equality comparison from each value. */
  readKey: ReadKeyFunction<T, K>;
}

/**
 * Set that is implemented internally using a Map, and input values have their keys read.
 *
 * Useful for cases, such as Date, that are unique by a value, but not self.
 */
export class HashSet<K extends PrimativeKey, T> implements Set<T> {
  private readonly _map = new Map<Maybe<K>, T>();
  private readonly _config: HashSetConfig<K, T>;

  /**
   * @param config - Configuration with the key extraction function.
   * @param values - Optional initial values to add.
   */
  constructor(config: HashSetConfig<K, T>, values?: T[]) {
    this._config = config;

    if (values) {
      values.forEach((x) => this.add(x));
    }
  }

  get config() {
    return this._config;
  }

  get size(): number {
    return this._map.size;
  }

  [Symbol.iterator](): MapIterator<T> {
    return this._map.values();
  }

  /**
   * Adds all values from the array to the set.
   *
   * @param values - The values to add, or null/undefined to skip.
   * @returns This set for chaining.
   */
  addAll(values: Maybe<T[]>): this {
    values?.forEach((x) => this.add(x));
    return this;
  }

  add(value: T): this {
    const key = this.config.readKey(value);
    this._map.set(key, value);
    return this;
  }

  clear(): void {
    this._map.clear();
  }

  delete(value: T): boolean {
    const key = this.config.readKey(value);
    return this._map.delete(key);
  }

  has(value: T): boolean {
    const key = this.config.readKey(value);
    return this.hasKeyValue(key);
  }

  /**
   * Checks whether a value with the given key exists in the set.
   *
   * @param key - The key to check for.
   * @returns `true` if a value with this key exists.
   */
  hasKeyValue(key: Maybe<K>): boolean {
    return this._map.has(key);
  }

  /**
   * Returns the value associated with the given key, or undefined if not found.
   *
   * @param key - The key to look up.
   * @returns The value, or undefined.
   */
  valueForKey(key: Maybe<K>): T | undefined {
    return this._map.get(key);
  }

  /**
   * Returns key-value entry pairs for each of the given keys. Missing values appear as undefined.
   *
   * @param keys - The keys to look up.
   * @returns An array of [key, value] tuples.
   */
  valueKeyEntriesForKeys(keys: Maybe<K>[]): [Maybe<K>, Maybe<T>][] {
    const values: [Maybe<K>, Maybe<T>][] = [];

    keys.forEach((key) => {
      const value = this.valueForKey(key);
      values.push([key, value]);
    });

    return values;
  }

  /**
   * Returns the values associated with the given keys, omitting keys that have no value.
   *
   * @param keys - The keys to look up.
   * @returns An array of found values.
   */
  valuesForKeys(keys: Maybe<K>[]): T[] {
    const values: T[] = [];

    keys.forEach((key) => {
      const value = this.valueForKey(key);

      if (value != null) {
        values.push(value);
      }
    });

    return values;
  }

  forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: unknown): void {
    return this._map.forEach((value) => {
      callbackfn.call(thisArg, value, value, this);
    });
  }

  entries(): SetIterator<[T, T]> {
    const result = this.valuesArray();
    return result.map((x) => [x, x] as [T, T]).values();
  }

  keys(): SetIterator<T> {
    return this.values();
  }

  values(): SetIterator<T> {
    return this._map.values();
  }

  /**
   * Returns all values in the set as an array.
   *
   * @returns An array of all stored values.
   */
  valuesArray(): T[] {
    return Array.from(this._map.values());
  }

  get [Symbol.toStringTag](): string {
    return this.valuesArray.toString();
  }
}
