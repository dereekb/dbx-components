
export type MapFn<A, B> = (value: A) => B;
export type MapStringFn<T> = MapFn<string, T>;
