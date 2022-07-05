import { Merge, NonNever, PickProperties, StrictOmit, UnionToIntersection, Writable } from 'ts-essentials';

/**
 * Class typing, restricted to types that have a constructor via the new keyword.
 */
export type ClassType<T = unknown> = {
  new (...args: unknown[]): T;
};

export type ObjectWithConstructor = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  constructor: Function;
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

export type ValuesTypesAsArray<T> = T[keyof T][];

/**
 * Converts the input value to a string, if possible. Never otherwise.
 */
export type KeyAsString<K> = `${KeyCanBeString<K>}`;
export type KeyCanBeString<K> = K extends number | boolean | string | null | undefined ? K : never;

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
 * Returns only properties that have string keys.
 */
export type StringKeyProperties<T> = NonNever<{
  [K in keyof T]: K extends string ? T[K] : never;
}>;

/**
 * Returns the name of all keys that are strings.
 */
export type StringKeyPropertyKeys<T> = keyof StringKeyProperties<T>;

/**
 * Makes a readonly type able to be configured. Useful for configurating readonly types before they are used.
 */
export type Configurable<T> = Writable<T>;

/**
 * StringConcatination of all keys of an object.
 */
export type CommaSeparatedKeysOfObject<T extends object> = CommaSeparatedKeys<`${KeyCanBeString<keyof T>}`>;
export type CommaSeparatedKeys<T extends string> = StringConcatination<T, ','>;

export type CommaSeparatedKeyCombinationsOfObject<T extends object> = CommaSeparatedKeyCombinations<`${KeyCanBeString<keyof T>}`>;
export type CommaSeparatedKeyCombinations<T extends string> = StringCombinations<T, ','>;

export type UnionToOvlds<U> = UnionToIntersection<U extends any ? (f: U) => void : never>;
export type PopUnion<U> = UnionToOvlds<U> extends (a: infer A) => void ? A : never;

/**
 * A type that merges all combinations of strings together using a separator.
 *
 * Example:
 * 'a' | 'b' | 'c' w/ ',' -> 'a' | 'b' | 'c' | 'a,b' | 'a,c' | 'a,b,c' | etc...
 *
 * Credit to:
 *
 * https://stackoverflow.com/a/65157132
 */
export type StringCombinations<S extends string, SEPARATOR extends string> = PopUnion<S> extends infer SELF
  ? //
    SELF extends string
    ? Exclude<S, SELF> extends never
      ? SELF
      : `${StringCombinations<Exclude<S, SELF>, SEPARATOR>}${SEPARATOR}${SELF}` | StringCombinations<Exclude<S, SELF>, SEPARATOR> | SELF
    : never
  : never;

/**
 * A type that merges all the input strings together using a separator.
 *
 * Example:
 * 'a' | 'b' | 'c' w/ ',' -> 'a,b,c' | 'a,c,b'
 */
export type StringConcatination<S extends string, SEPARATOR extends string> = PopUnion<S> extends infer SELF
  ? //
    SELF extends string
    ? Exclude<S, SELF> extends never
      ? SELF
      : `${StringConcatination<Exclude<S, SELF>, SEPARATOR>}${SEPARATOR}${SELF}` | `${SELF}${SEPARATOR}${StringConcatination<Exclude<S, SELF>, SEPARATOR>}`
    : never
  : never;
