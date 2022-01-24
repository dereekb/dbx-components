import { distinctUntilChanged, MonoTypeOperatorFunction } from "rxjs";

export function distinctUntilArrayLengthChanges<A>(getArray: (value: A) => any[]): MonoTypeOperatorFunction<A>;
export function distinctUntilArrayLengthChanges<T>(): MonoTypeOperatorFunction<T[]>;
export function distinctUntilArrayLengthChanges<A>(getArray?: (value: A) => any[]): MonoTypeOperatorFunction<A> {
  if (!getArray) {
    getArray = (value: A) => value as any as any[]
  }

  return distinctUntilChanged((a, b) => a === b, (x) => getArray(x).length);
}
