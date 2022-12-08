import { MapFunction } from '../value/map';
import { Maybe } from '../value/maybe.type';

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

export function caseInsensitiveString(input: string): string;
export function caseInsensitiveString(input: undefined): undefined;
export function caseInsensitiveString(input: Maybe<string>): Maybe<string>;
export function caseInsensitiveString(input: Maybe<string>): Maybe<string> {
  return input?.toLocaleLowerCase();
}

export function splitCommaSeparatedString(input: CommaSeparatedString<string>): string[];
export function splitCommaSeparatedString<T = unknown>(input: CommaSeparatedString<T>, mapFn: MapStringFunction<T>): T[];
export function splitCommaSeparatedString<T = unknown>(input: CommaSeparatedString<T>, mapFn: MapStringFunction<T> = (x) => x as unknown as T): T[] {
  const splits = input.split(',');
  return splits.map((x) => mapFn(x.trim()));
}

export function splitCommaSeparatedStringToSet(input: Maybe<CommaSeparatedString>): Set<string> {
  return new Set(input != null ? splitCommaSeparatedString(input) : []);
}

/**
 * Adds a plus prefix to the input value and converts it to a string. If the value is negative or 0, no prefix is added.
 *
 * Undefined is returned if a null/undefined value is input.
 */
export function addPlusPrefixToNumber(value?: Maybe<number>, prefix = '+'): string | undefined {
  if (value != null) {
    return value > 0 ? `${prefix}${value}` : `${value}`;
  } else {
    return undefined;
  }
}

/**
 * Capitalizes the first letter of the input.
 *
 * @param value
 * @returns
 */
export function capitalizeFirstLetter(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Lowercases the first letter of the input.
 *
 * @param value
 * @returns
 */
export function lowercaseFirstLetter(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * Performs split, but joins the remainder instead of discarding them.
 *
 * @param input
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

export type FirstNameLastNameTuple = [string, string | undefined];

/**
 * Splits the input string like it is a name with a space separating the first and last name string.
 *
 * @param input
 * @returns
 */
export function splitJoinNameString(input: string): FirstNameLastNameTuple {
  return splitJoinRemainder(input, ' ', 2) as FirstNameLastNameTuple;
}
