import { type Maybe } from '../value/maybe.type';

/**
 * A character or string that is added to the start of a string.
 *
 * Example: '-' in "-class"
 */
export type CharacterPrefix = string;

/**
 * A character or string that is added to the end of a string.
 *
 * Example: '-' in "class-"
 */
export type CharacterSuffix = string;

/**
 * A string that does not have a CharacterPrefix or CharacterSuffix.
 */
export type CharacterPrefixSuffixCleanString = string;

/**
 * A string that is a combination of a prefix and suffix.
 */
export type CharacterPrefixSuffixString<P extends CharacterPrefix = '', S extends CharacterSuffix = '', T extends string = string> = `${P}${T}${S}`;

/**
 * A string that has a known prefix.
 */
export type CharacterPrefixString<P extends CharacterPrefix = '', T extends string = string> = CharacterPrefixSuffixString<P, '', T>;

/**
 * A string that has a known suffix.
 */
export type CharacterSuffixString<S extends CharacterSuffix = '', T extends string = string> = CharacterPrefixSuffixString<'', S, T>;

export interface CharacterPrefixSuffixInstanceConfiguration<P extends CharacterPrefix = '', S extends CharacterSuffix = ''> {
  /**
   * The prefix characters to add/remove to/from the start of the string.
   */
  readonly prefix?: Maybe<P>;
  /**
   * The suffix characters to add/remove to/from the end of the string.
   */
  readonly suffix?: Maybe<S>;
  /**
   * If true, the prefix will be added to empty strings.
   */
  readonly prefixEmptyString?: boolean;
  /**
   * If true, the suffix will be added to empty strings.
   */
  readonly suffixEmptyString?: boolean;
}

export interface CharacterPrefixSuffixInstance<P extends CharacterPrefix = '', S extends CharacterSuffix = ''> extends CharacterPrefixSuffixInstanceConfiguration<P, S> {
  /**
   * Adds the prefix and suffix to the input string.
   *
   * @param input
   */
  prefixSuffixString(input: ''): string;
  prefixSuffixString<T extends string>(input: T | CharacterPrefixSuffixString<P, S, T> | CharacterPrefixString<P, T> | CharacterSuffixString<S, T>): CharacterPrefixSuffixString<P, S, T>;
  prefixSuffixString(input: string): CharacterPrefixSuffixString<P, S>;

  /**
   * Removes the prefix and suffix from the input string.
   *
   * @param input
   */
  cleanString<T extends string>(input: T | CharacterPrefixSuffixString<P, S, T> | CharacterPrefixString<P, T> | CharacterSuffixString<S, T>): T;
  cleanString(input: string): string;
}

/**
 * Creates a CharacterPrefixSuffixInstance
 *
 * @param config
 * @returns
 */
export function characterPrefixSuffixInstance<P extends CharacterPrefix = '', S extends CharacterSuffix = ''>(config: CharacterPrefixSuffixInstanceConfiguration<P, S>): CharacterPrefixSuffixInstance<P, S> {
  const { prefix: inputPrefix, suffix: inputSuffix, prefixEmptyString, suffixEmptyString } = config;

  const prefix = inputPrefix ?? ('' as P);
  const suffix = inputSuffix ?? ('' as S);

  function cleanString<T extends string = string>(input: T | CharacterPrefixSuffixString<P, S, T> | CharacterPrefixString<P, T> | CharacterSuffixString<S, T>): T {
    let result = input as string;

    // Handle cases where the prefix might be repeated (e.g., "--dark")
    if (prefix) {
      while (result.startsWith(prefix)) {
        result = result.slice(prefix.length);
      }
    }

    // Handle cases where the suffix might be repeated (e.g., "dark--")
    if (suffix) {
      while (result.endsWith(suffix)) {
        result = result.slice(0, result.length - suffix.length);
      }
    }

    return result as T;
  }

  function prefixSuffixString<T extends string = string>(input: T | CharacterPrefixSuffixString<P, S, T> | CharacterPrefixString<P, T> | CharacterSuffixString<S, T>): CharacterPrefixSuffixString<P, S, T> {
    const clean = cleanString(input);
    let result: CharacterPrefixSuffixString<P, S, T>;

    if (clean === '') {
      result = '' as CharacterPrefixSuffixString<P, S, T>;

      if (prefixEmptyString) {
        result = `${prefix}${clean}` as CharacterPrefixSuffixString<P, S, T>;
      }

      if (suffixEmptyString) {
        result = `${result}${suffix}` as CharacterPrefixSuffixString<P, S, T>;
      }
    } else {
      result = `${prefix}${clean}${suffix}` as CharacterPrefixSuffixString<P, S, T>;
    }

    return result;
  }

  return {
    prefix,
    suffix,
    prefixEmptyString,
    suffixEmptyString,
    prefixSuffixString,
    cleanString
  };
}

/**
 * A string with a dash prefix.
 *
 * Example: "-class"
 */
export type DashPrefixString = CharacterPrefixString<'-'>;

/**
 * A pre-configured instance that can be used to add/remove dash prefixes from a string.
 */
export const DASH_CHARACTER_PREFIX_INSTANCE = characterPrefixSuffixInstance({
  prefix: '-'
});
