import { type ArrayOrValue, asArray } from '../array/array';
import { type MapFunction } from '../value/map';
import { type MaybeNot, type Maybe } from '../value/maybe.type';

/**
 * Converts a string to a value.
 */
export type MapStringFunction<T> = MapFunction<string, T>;

/**
 * Reads a string from the input value.
 */
export type ReadStringFunction<T, S extends string = string> = MapFunction<T, S>;

/**
 * Represents a string that is made up of comma-separated values.
 *
 * Optional generic typing exists for communicating what values are separated within the string.
 *
 * I.E. 0,1,2
 */
// eslint-disable-next-line
export type CommaSeparatedString<T = unknown> = string;

/**
 * Represents a string that is made up of space-separated values.
 *
 * Optional generic typing exists for communicating what values are separated within the string.
 *
 * I.E. 0 1 2
 */
// eslint-disable-next-line
export type SpaceSeparatedString<T = unknown> = string;

/**
 * Default comma joiner character used by comma-related string functions.
 */
export const COMMA_JOINER = ',';

/**
 * Converts a string to its lowercase equivalent for case-insensitive comparison.
 *
 * @param input - string to convert to lowercase
 * @returns the lowercased string, or undefined if the input is undefined
 */
export function caseInsensitiveString(input: string): string;
export function caseInsensitiveString(input: undefined): undefined;
export function caseInsensitiveString(input: Maybe<string>): Maybe<string>;
export function caseInsensitiveString(input: Maybe<string>): Maybe<string> {
  return input?.toLocaleLowerCase();
}

/**
 * Joins an array of strings into a single string. Trims and omits empty values.
 *
 * @param input string or array of strings
 * @param joiner string to join the strings with. Defaults to a comma.
 * @param trim whether or not to trim the strings before joining. Defaults to false.
 * @returns joined string, or null/undefined if the input is null/undefined
 */
export function joinStrings(input: MaybeNot, joiner?: string, trim?: boolean): MaybeNot;
export function joinStrings(input: ArrayOrValue<Maybe<string>>, joiner?: string, trim?: boolean): string;
export function joinStrings(input: Maybe<ArrayOrValue<Maybe<string>>>, joiner: string = COMMA_JOINER, trim: boolean = false): Maybe<string> {
  if (input == null) {
    return input;
  }

  let array: Maybe<string>[] = asArray(input);

  if (trim) {
    array = array.map((x) => x?.trim());
  }

  return array.filter(Boolean).join(joiner);
}

/**
 * Joins an array of strings into a single string using commas. Does not trim empty values by default.
 *
 * @param input string or array of strings
 * @param trim whether or not to trim the strings before joining. Defaults to false.
 * @returns joined string, or null/undefined if the input is null/undefined
 */
export function joinStringsWithCommas(input: MaybeNot): MaybeNot;
export function joinStringsWithCommas(input: ArrayOrValue<Maybe<string>>): string;
export function joinStringsWithCommas(input: Maybe<ArrayOrValue<Maybe<string>>>, trim: boolean = false): Maybe<string> {
  return joinStrings(input, COMMA_JOINER, trim);
}

/**
 * Splits a comma-separated string into an array of strings.
 *
 * @param input string to split
 * @param mapFn function to map each split string to a value
 * @returns array of strings
 */
export function splitCommaSeparatedString(input: CommaSeparatedString<string>): string[];
export function splitCommaSeparatedString<T = unknown>(input: CommaSeparatedString<T>, mapFn: MapStringFunction<T>): T[];
export function splitCommaSeparatedString<T = unknown>(input: CommaSeparatedString<T>, mapFn: MapStringFunction<T> = (x) => x as unknown as T): T[] {
  const splits = input.split(COMMA_JOINER);
  return splits.map((x) => mapFn(x.trim()));
}

/**
 * Splits a comma-separated string into a Set of unique trimmed string values.
 *
 * @param input - comma-separated string to split, or null/undefined
 * @returns a Set of unique string values; empty Set if input is null/undefined
 */
export function splitCommaSeparatedStringToSet(input: Maybe<CommaSeparatedString>): Set<string> {
  return new Set(input != null ? splitCommaSeparatedString(input) : []);
}

/**
 * Adds a plus prefix to the input value and converts it to a string. If the value is negative or 0, no prefix is added.
 *
 * Undefined is returned if a null/undefined value is input.
 *
 * @param value - the number to prefix
 * @param prefix - the prefix character to use for positive numbers; defaults to '+'
 * @returns the prefixed string, or undefined if the input is null/undefined
 */
export function addPlusPrefixToNumber(value?: Maybe<number>, prefix = '+'): string | undefined {
  if (value != null) {
    return value > 0 ? `${prefix}${value}` : `${value}`;
  } else {
    return undefined;
  }
}

/**
 * Capitalizes the first letter of the input string.
 *
 * @param value - string to capitalize
 * @returns the input string with its first character uppercased
 */
export function capitalizeFirstLetter(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Lowercases the first letter of the input string.
 *
 * @param value - string to modify
 * @returns the input string with its first character lowercased
 */
export function lowercaseFirstLetter(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * Splits a string like {@link String.prototype.split}, but joins overflow segments back together
 * instead of discarding them. Useful when you only want to split on the first N-1 occurrences.
 *
 * @param input - string to split
 * @param separator - delimiter to split on
 * @param limit - maximum number of resulting segments; overflow segments are rejoined with the separator
 * @returns array of string segments, with length at most equal to limit
 */
export function splitJoinRemainder(input: string, separator: string, limit: number): string[] {
  const split = input.split(separator);
  const components: string[] = [];

  if (split.length > 1) {
    const hasItemsToMerge = split.length > limit;
    const stopIndex = hasItemsToMerge ? limit - 1 : split.length;

    for (let i = 0; i < stopIndex; i += 1) {
      components.push(split[i]);
    }

    if (hasItemsToMerge) {
      components.push(split.slice(stopIndex).join(separator));
    }
  } else {
    components.push(split[0]);
  }

  return components;
}

/**
 * A tuple of [firstName, lastName] where lastName may be undefined if the input has no space.
 */
export type FirstNameLastNameTuple = [string, string | undefined];

/**
 * Default space joiner character used by space-related string functions.
 */
export const SPACE_JOINER = ' ';

/**
 * Splits the input string into a first name and last name tuple using a space as the delimiter.
 * If the name contains more than one space, the remainder is treated as the last name.
 *
 * @param input - full name string to split
 * @returns a tuple of [firstName, lastName], where lastName includes all text after the first space
 */
export function splitJoinNameString(input: string): FirstNameLastNameTuple {
  return splitJoinRemainder(input, SPACE_JOINER, 2) as FirstNameLastNameTuple;
}

/**
 * Joins one or more strings together with spaces. Extra spaces are trimmed from the values.
 *
 * @param input string or array of strings
 * @returns joined string, or null/undefined if the input is null/undefined
 */
export function joinStringsWithSpaces(input: MaybeNot): MaybeNot;
export function joinStringsWithSpaces(input: ArrayOrValue<Maybe<string>>): string;
export function joinStringsWithSpaces(input: Maybe<ArrayOrValue<Maybe<string>>>): Maybe<string> {
  return joinStrings(input, SPACE_JOINER, true);
}

/**
 * Creates a string that repeats the given string a specified number of times.
 *
 * @param string - the string to repeat
 * @param reapeat - number of times to repeat the string
 * @returns the repeated string concatenation
 */
export function repeatString(string: string, reapeat: number): string {
  let result = '';

  for (let i = 0; i < reapeat; i += 1) {
    result += string;
  }

  return result;
}

/**
 * Configuration for creating a {@link CutStringFunction}.
 */
export interface CutStringFunctionConfig {
  /**
   * Max length of the string.
   */
  readonly maxLength: number;
  /**
   * Whether or not the end text addition should be included in the max length computation.
   *
   * If false, then the input string will be cut at the max length.
   */
  readonly maxLengthIncludesEndText?: Maybe<boolean>;
  /**
   * The end text to add to the cut string.
   *
   * Defaults to "...".
   */
  readonly endText?: Maybe<string>;
}

/**
 * Default ellipsis text appended when a string is truncated by {@link cutStringFunction}.
 */
export const DEFAULT_CUT_STRING_END_TEXT = '...';

/**
 * A function that truncates a string to a configured maximum length, optionally appending end text.
 */
export type CutStringFunction = ((input: string) => string) & ((input: Maybe<string>) => Maybe<string>);

/**
 * Creates a {@link CutStringFunction} that truncates strings exceeding the configured maximum length.
 *
 * @param config - configuration controlling max length and end text behavior
 * @returns a reusable function that truncates input strings
 */
export function cutStringFunction(config: CutStringFunctionConfig): CutStringFunction {
  const { maxLength: inputMaxLength, maxLengthIncludesEndText, endText: inputEndText } = config;
  const endText = inputEndText === undefined ? DEFAULT_CUT_STRING_END_TEXT : '';
  const maxLength = maxLengthIncludesEndText !== false ? inputMaxLength - endText.length : inputMaxLength;

  return ((input: Maybe<string>) => {
    let result: Maybe<string> = input;

    if (input != null) {
      const inputLength = input.length;

      if (inputLength > inputMaxLength) {
        result = input.substring(0, maxLength) + endText;
      } else {
        result = input;
      }
    }

    return result;
  }) as CutStringFunction;
}

/**
 * Truncates a string to the given maximum length, appending end text (defaults to "...") if truncated.
 *
 * @param input - the string to truncate, or null/undefined
 * @param maxLength - maximum allowed length for the output string
 * @param endText - text to append when truncated; defaults to "..."
 * @returns the truncated string, or null/undefined if the input is null/undefined
 */
export function cutString(input: Maybe<string>, maxLength: number, endText?: Maybe<string>): Maybe<string> {
  return cutStringFunction({ maxLength, endText })(input);
}

/**
 * Collapses consecutive whitespace characters (excluding newlines) into a single space, then trims.
 *
 * Newlines are preserved.
 *
 * @param input - string to flatten
 * @returns the string with collapsed whitespace
 */
export function flattenWhitespace(input: string): string {
  return input.replace(/[^\S\r\n]+/g, ' ').trim();
}

/**
 * Reduces multiple consecutive newlines to a single newline and collapses multiple whitespace characters to a single space.
 *
 * @param input - string to simplify
 * @returns the string with simplified whitespace and newlines
 */
export function simplifyWhitespace(input: string): string {
  return input.split(/\r?\n/).filter(Boolean).map(flattenWhitespace).join('\n');
}
