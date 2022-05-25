import { PrimativeKey, ReadKeyFunction } from "../key";
import { Maybe } from "../value/maybe";

export interface HashSetConfig<K extends PrimativeKey, T> {
  readKey: ReadKeyFunction<T, K>;
}

/**
 * Set that is implemented internally using a Map, and input values have their keys read.
 * 
 * Useful for cases, such as Date, that are unique by a value, but not self.
 */
export class HashSet<K extends PrimativeKey, T> implements Set<T> {

  private _map = new Map<Maybe<K>, T>();

  constructor(readonly config: HashSetConfig<K, T>, values?: T[]) {
    if (values) {
      values.forEach(x => this.add(x));
    }
  }

  get size(): number {
    return this._map.size;
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this._map.values();
  }

  addAll(values: Maybe<T[]>): this {
    values?.forEach(x => this.add(x));
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
    return this._map.has(key);
  }

  forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: unknown): void {
    return this._map.forEach((value) => {
      callbackfn.apply(thisArg, [value, value, this]);
    });
  }

  entries(): IterableIterator<[T, T]> {
    const result = this.valuesArray();
    return result.map(x => [x, x] as [T, T]).values();
  }

  keys(): IterableIterator<T> {
    return this.values();
  }

  values(): IterableIterator<T> {
    return this._map.values();
  }

  valuesArray(): T[] {
    return Array.from(this._map.values());
  }

  get [Symbol.toStringTag](): string {
    return this.valuesArray.toString();
  }

}
