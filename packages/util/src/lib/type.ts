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
 * Makes the input key(s) required.
 */
export type RequiredOnKeys<T, K> = K extends keyof T ? Omit<T, K> & Required<Pick<T, K>> : T;

/**
 * Makes the input key(s) partials.
 */
export type PartialOnKeys<T, K> = K extends keyof T ? Omit<T, K> & Partial<Pick<T, K>> : T;

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
 * StringOrder of all keys of an object.
 *
 * NOTE: Intellisense may not return the correct order.
 */
export type CommaSeparatedKeyOrderOfObject<T extends object> = CommaSeparatedKeyOrder<`${KeyCanBeString<keyof T>}`>;
export type CommaSeparatedKeyOrder<T extends string> = StringOrder<T, ','>;

/**
 * StringCombinations of all keys of an object.
 */
export type CommaSeparatedKeyCombinationsOfObject<T extends object> = CommaSeparatedKeyCombinations<`${KeyCanBeString<keyof T>}`>;
export type CommaSeparatedKeyCombinations<T extends string> = StringCombination<T, ','>;

/**
 * StringConcatenationApproximation of keys of an object in approximate order.
 */
export type CommaSeparatedKeysOfObject<T extends object> = CommaSeparatedKeys<`${KeyCanBeString<keyof T>}`>;
export type CommaSeparatedKeys<T extends string> = StringConcatenationApproximation<T, ','>;

/**
 * StringConcatenation of all keys of an object in no particular order.
 *
 * May fail for more complex types, requiring the use of CommaSeparatedKeysOfObject.
 */
export type AllCommaSeparatedKeysOfObject<T extends object> = AllCommaSeparatedKeys<`${KeyCanBeString<keyof T>}`>;
export type AllCommaSeparatedKeys<T extends string> = StringConcatenation<T, ','>;

/**
 * StringConcatenationOrder of all keys of an object in ascending order.
 *
 * NOTE: Intellisense may not return the correct order.
 */
export type OrderedCommaSeparatedKeysOfObject<T extends object> = OrderedCommaSeparatedKeys<`${KeyCanBeString<keyof T>}`>;
export type OrderedCommaSeparatedKeys<T extends string> = StringConcatenationOrder<T, ','>;

export type UnionToOvlds<U> = UnionToIntersection<U extends any ? (f: U) => void : never>;
export type PopUnion<U> = UnionToOvlds<U> extends (a: infer A) => void ? A : never;

/**
 * A type that merges all combinations of strings together using a separator, but restricts the result to ascending lexigraphical order.
 *
 * NOTE: Intellisense may not display the correct order, but Typescript will enforce the expected order.
 *
 * Example:
 * 'a' | 'b' | 'c' w/ ',' -> 'a' | 'b' | 'c' | 'a,b' | 'a,c' | 'a,b,c' | etc...
 *
 * Credit to:
 *
 * https://stackoverflow.com/a/65157132
 */
export type StringOrder<S extends string, SEPARATOR extends string> = PopUnion<S> extends infer SELF
  ? //
    SELF extends string
    ? Exclude<S, SELF> extends never
      ? SELF
      : // This works because the values of S are always sorted and interpreted in an ascending order
        `${StringOrder<Exclude<S, SELF>, SEPARATOR>}${SEPARATOR}${SELF}` | StringOrder<Exclude<S, SELF>, SEPARATOR> | SELF
    : never
  : never;

/**
 * A type that merges all combinations of strings together using a separator.
 *
 * Example:
 * 'a' | 'b' | 'c' w/ ',' -> 'a' | 'b' | 'c' | 'a,b' | 'b,a' | 'c,a,b' | etc...
 */
export type StringCombination<S extends string, SEPARATOR extends string> = PopUnion<S> extends infer SELF
  ? //
    SELF extends string
    ? Exclude<S, SELF> extends never
      ? SELF
      : `${StringCombination<Exclude<S, SELF>, SEPARATOR>}${SEPARATOR}${SELF}` | `${SELF}${SEPARATOR}${StringCombination<Exclude<S, SELF>, SEPARATOR>}` | StringCombination<Exclude<S, SELF>, SEPARATOR> | SELF
    : never
  : never;

/**
 * A type that merges all the input strings together and requires them sorted and interpreted in an ascending order
 *
 * NOTE: Intellisense may not display the correct order, but Typescript will enforce the expected order.
 *
 * Example:
 * 'a' | 'c' | 'b' w/ ',' -> 'a,b,c'
 */
export type StringConcatenationOrder<S extends string, SEPARATOR extends string> = PopUnion<S> extends infer SELF
  ? //
    SELF extends string
    ? Exclude<S, SELF> extends never
      ? `${SELF}`
      : // This works because the values of S are always interpreted in ascending order
        `${StringConcatenationOrder<Exclude<S, SELF>, SEPARATOR>}${SEPARATOR}${SELF}`
    : never
  : never;

/**
 * A type that merges all the input strings together using a separator.
 *
 * Example:
 * 'a' | 'b' | 'c' w/ ',' -> 'a,b,c' | 'a,c,b' | 'b,a,c' | etc...
 */
export type StringConcatenation<S extends string, SEPARATOR extends string> = StringConcatenationMany<S, SEPARATOR>;

/**
 * Used to "approximate" larger concatenations. In reality, this just excludes the earlier types from being present in the middle.
 */
export type StringConcatenationApproximation<S extends string, SEPARATOR extends string> = PopUnion<S> extends infer SELF
  ? //
    SELF extends string
    ? Exclude<S, SELF> extends never
      ? `${SELF}`
      : `${StringConcatenationApproximation<Exclude<S, SELF>, SEPARATOR>}${SEPARATOR}${SELF}` | `${SELF}${SEPARATOR}${StringConcatenationApproximation<Exclude<S, SELF>, SEPARATOR>}`
    : never
  : never;

/**
 * Creates the concatenations for the input.
 *
 * Total number of concatenations is equal to n!.
 *
 * The max number of strings allowed is 7. If there are more than 7 strings passed, this function will use StringConcatenationApproximation.
 */
export type StringConcatenationMany<S extends string, SEPARATOR extends string> =
  // a | b | c | d | e | f | g | h | i | j | k | l | m
  PopUnion<S> extends infer ONE
    ? // one
      ONE extends string
      ? PopUnion<Exclude<S, ONE>> extends infer TWO
        ? // two
          TWO extends string
          ? Exclude<S, ONE | TWO> extends never
            ? StringConcatinateTwo<ONE, TWO, SEPARATOR>
            : PopUnion<Exclude<S, ONE | TWO>> extends infer THREE
            ? // three
              THREE extends string
              ? Exclude<S, ONE | TWO | THREE> extends never
                ? StringConcatinateThree<ONE, TWO, THREE, SEPARATOR>
                : PopUnion<Exclude<S, ONE | TWO | THREE>> extends infer FOUR
                ? // four
                  FOUR extends string
                  ? Exclude<S, ONE | TWO | THREE | FOUR> extends never
                    ? StringConcatinateFour<ONE, TWO, THREE, FOUR, SEPARATOR>
                    : PopUnion<Exclude<S, ONE | TWO | THREE | FOUR>> extends infer FIVE
                    ? // five
                      FIVE extends string
                      ? Exclude<S, ONE | TWO | THREE | FOUR | FIVE> extends never
                        ? StringConcatinateFive<ONE, TWO, THREE, FOUR, FIVE, SEPARATOR>
                        : PopUnion<Exclude<S, ONE | TWO | THREE | FOUR | FIVE>> extends infer SIX
                        ? // six
                          SIX extends string
                          ? Exclude<S, ONE | TWO | THREE | FOUR | FIVE | SIX> extends never
                            ? StringConcatinateSix<ONE, TWO, THREE, FOUR, FIVE, SIX, SEPARATOR>
                            : PopUnion<Exclude<S, ONE | TWO | THREE | FOUR | FIVE | SIX>> extends infer SEVEN
                            ? // seven
                              SEVEN extends string
                              ? Exclude<S, ONE | TWO | THREE | FOUR | FIVE | SIX | SEVEN> extends never
                                ? StringConcatinateSeven<ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, SEPARATOR>
                                : PopUnion<Exclude<S, ONE | TWO | THREE | FOUR | FIVE | SIX | SEVEN>> extends infer EIGHT
                                ? // eight
                                  EIGHT extends string
                                  ? StringConcatenationApproximation<S, SEPARATOR> // use approximation, do not calculate 8! items
                                  : never
                                : StringConcatinateSeven<ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, SEPARATOR>
                              : never
                            : StringConcatinateSix<ONE, TWO, THREE, FOUR, FIVE, SIX, SEPARATOR>
                          : never
                        : StringConcatinateFive<ONE, TWO, THREE, FOUR, FIVE, SEPARATOR>
                      : never
                    : StringConcatinateFour<ONE, TWO, THREE, FOUR, SEPARATOR>
                  : never
                : StringConcatinateThree<ONE, TWO, THREE, SEPARATOR>
              : StringConcatinateTwo<ONE, TWO, SEPARATOR>
            : StringConcatinateTwo<ONE, TWO, SEPARATOR>
          : never
        : ONE
      : never
    : never;

export type StringConcatinateTwo<LEFT extends string, SELF extends string, SEPARATOR extends string> = `${LEFT}${SEPARATOR}${SELF}` | `${SELF}${SEPARATOR}${LEFT}`;
export type StringConcatinateThree<LEFT extends string, RIGHT extends string, SELF extends string, SEPARATOR extends string> = `${LEFT}${SEPARATOR}${SELF}${SEPARATOR}${RIGHT}` | `${LEFT}${SEPARATOR}${RIGHT}${SEPARATOR}${SELF}` | `${SELF}${SEPARATOR}${RIGHT}${SEPARATOR}${LEFT}` | `${SELF}${SEPARATOR}${LEFT}${SEPARATOR}${RIGHT}` | `${RIGHT}${SEPARATOR}${LEFT}${SEPARATOR}${SELF}` | `${RIGHT}${SEPARATOR}${SELF}${SEPARATOR}${LEFT}`;
export type StringConcatinateFour<ONE extends string, TWO extends string, THREE extends string, FOUR extends string, SEPARATOR extends string> = `${StringConcatinateThree<ONE, TWO, THREE, SEPARATOR>}${SEPARATOR}${FOUR}` | `${StringConcatinateThree<TWO, THREE, FOUR, SEPARATOR>}${SEPARATOR}${ONE}` | `${StringConcatinateThree<THREE, FOUR, ONE, SEPARATOR>}${SEPARATOR}${TWO}` | `${StringConcatinateThree<FOUR, ONE, TWO, SEPARATOR>}${SEPARATOR}${THREE}`;
export type StringConcatinateFive<ONE extends string, TWO extends string, THREE extends string, FOUR extends string, FIVE extends string, SEPARATOR extends string> =
  | `${StringConcatinateFour<ONE, TWO, THREE, FOUR, SEPARATOR>}${SEPARATOR}${FIVE}`
  | `${StringConcatinateFour<TWO, THREE, FOUR, FIVE, SEPARATOR>}${SEPARATOR}${ONE}`
  | `${StringConcatinateFour<THREE, FOUR, FIVE, ONE, SEPARATOR>}${SEPARATOR}${TWO}`
  | `${StringConcatinateFour<FOUR, FIVE, ONE, TWO, SEPARATOR>}${SEPARATOR}${THREE}`
  | `${StringConcatinateFour<FIVE, ONE, TWO, THREE, SEPARATOR>}${SEPARATOR}${FOUR}`;
export type StringConcatinateSix<ONE extends string, TWO extends string, THREE extends string, FOUR extends string, FIVE extends string, SIX extends string, SEPARATOR extends string> =
  | `${StringConcatinateFive<ONE, TWO, THREE, FOUR, FIVE, SEPARATOR>}${SEPARATOR}${SIX}`
  | `${StringConcatinateFive<TWO, THREE, FOUR, FIVE, SIX, SEPARATOR>}${SEPARATOR}${ONE}`
  | `${StringConcatinateFive<THREE, FOUR, FIVE, SIX, ONE, SEPARATOR>}${SEPARATOR}${TWO}`
  | `${StringConcatinateFive<FOUR, FIVE, SIX, ONE, TWO, SEPARATOR>}${SEPARATOR}${THREE}`
  | `${StringConcatinateFive<FIVE, SIX, ONE, TWO, THREE, SEPARATOR>}${SEPARATOR}${FOUR}`
  | `${StringConcatinateFive<SIX, ONE, TWO, THREE, FOUR, SEPARATOR>}${SEPARATOR}${FIVE}`;
export type StringConcatinateSeven<ONE extends string, TWO extends string, THREE extends string, FOUR extends string, FIVE extends string, SIX extends string, SEVEN extends string, SEPARATOR extends string> =
  | `${StringConcatinateSix<SEVEN, ONE, TWO, THREE, FOUR, FIVE, SEPARATOR>}${SEPARATOR}${SIX}`
  | `${StringConcatinateSix<TWO, THREE, FOUR, FIVE, SIX, SEVEN, SEPARATOR>}${SEPARATOR}${ONE}`
  | `${StringConcatinateSix<THREE, FOUR, FIVE, SIX, SEVEN, ONE, SEPARATOR>}${SEPARATOR}${TWO}`
  | `${StringConcatinateSix<FOUR, FIVE, SIX, SEVEN, ONE, TWO, SEPARATOR>}${SEPARATOR}${THREE}`
  | `${StringConcatinateSix<FIVE, SIX, SEVEN, ONE, TWO, THREE, SEPARATOR>}${SEPARATOR}${FOUR}`
  | `${StringConcatinateSix<SIX, SEVEN, ONE, TWO, THREE, FOUR, SEPARATOR>}${SEPARATOR}${FIVE}`;

export type IsSingleCharacter<S extends string> = PopUnion<S> extends infer SELF ? (Exclude<S, SELF> extends never ? S : never) : never;

export type HasTwoOrMoreCharacters<S extends string> =
  // a | b | c
  PopUnion<S> extends infer FIRST
    ? // a
      FIRST extends string
      ? // b | c
        PopUnion<Exclude<S, FIRST>> extends infer SECOND
        ? SECOND extends string
          ? S
          : never
        : never
      : never
    : never;

export type HasThreeCharacters<S extends string> =
  // a | b | c
  PopUnion<S> extends infer FIRST
    ? // a
      FIRST extends string
      ? // b | c
        PopUnion<Exclude<S, FIRST>> extends infer SECOND
        ? // b
          SECOND extends string
          ? // c
            PopUnion<Exclude<S, FIRST | SECOND>> extends infer THIRD
            ? THIRD extends string
              ? Exclude<S, FIRST | SECOND | THIRD> extends never
                ? S
                : never
              : never
            : never
          : never
        : never
      : never
    : never;

export type HasThreeOrMoreCharacters<S extends string> =
  // a | b | c
  PopUnion<S> extends infer FIRST
    ? // a
      FIRST extends string
      ? // b | c
        PopUnion<Exclude<S, FIRST>> extends infer SECOND
        ? // b
          SECOND extends string
          ? // c
            PopUnion<Exclude<S, FIRST | SECOND>> extends infer THIRD
            ? THIRD extends string
              ? S
              : never
            : never
          : never
        : never
      : never
    : never;

// MARK: Compat
/**
 * @deprecated use StringConcatenation
 */
export type StringConcatination<S extends string, SEPARATOR extends string> = StringConcatenation<S, SEPARATOR>;

/**
 * @deprecated use StringCombination
 */
export type StringCombinations<S extends string, SEPARATOR extends string> = StringCombination<S, SEPARATOR>;
