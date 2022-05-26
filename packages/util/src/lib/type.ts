import { Merge, PickProperties, StrictOmit, Writable } from 'ts-essentials';

/**
 * Class typing, restricted to types that have a constructor via the new keyword.
 */
export type ClassType<T = unknown> = {
  new (...args: unknown[]): T;
};

/**
 * Similar to ClassType, but allows for abstract classes.
 */
export type ClassLikeType<T = unknown> = abstract new (...args: unknown[]) => T;

/**
 * Special type used to defined other type definitions that state the defined type has every key of one type, but each key has a single/new value type.
 */
export type KeyValueTransformMap<T, V, X extends keyof T = keyof T> = {
  [K in X]: V;
};

export type StringKeyValueTransformMap<T, V> = {
  [K in keyof T as string]: V;
};

export type KeysAsStrings<T> = {
  [K in keyof T as string]: T[K];
};

export type BooleanKeyValueTransformMap<T> = KeyValueTransformMap<T, boolean>;

// MARK: Typings
/**
 * Merges the types T and R, but replaces keys within T with those in R.
 */
export type MergeReplace<T, R> = Merge<T, R>;

/**
 * Similar to MergeReplace, but only allows keys that are defined within T.
 */
export type Replace<T, R> = StrictOmit<MergeReplace<T, R>, Exclude<keyof R, keyof T>>;

/**
 * Similar to Replace, but all types that were not replaced are set to the third type (default unknown).
 */
export type ReplaceType<I extends object, O extends object, X = unknown> = {
  [K in keyof I]: K extends keyof O ? O[K] : X;
};

export type OnlyStringKeys<T> = PickProperties<T, 'string'>;

export type RemoveIndex<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K]; // if key is not a string or a number
};

/**
 * Custom typing used to only retain known keys on types that have a [key: string] in their type.
 *
 * https://stackoverflow.com/questions/51954558/how-can-i-remove-a-wider-type-from-a-union-type-without-removing-its-subtypes-in/51955852#51955852
 */
export type KnownKeys<T> = keyof RemoveIndex<T>;

/**
 * Makes a readonly type able to be configured. Useful for configurating readonly types before they are used.
 */
export type Configurable<T> = Writable<T>;
