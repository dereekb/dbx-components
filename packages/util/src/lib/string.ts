import { MapStringFn } from "./map/map";
import { Maybe } from "./value/maybe";

/**
 * Represents a string that is made up of comma-separated values.
 * 
 * Optional generic typing exists for communicating what values are separated within the string.
 * 
 * I.E. 0,1,2
 */
export type CommaSeparatedString<T = unknown> = string;

export function caseInsensitiveString(input: string): string;
export function caseInsensitiveString(input: undefined): undefined;
export function caseInsensitiveString(input: Maybe<string>): Maybe<string>;
export function caseInsensitiveString(input: Maybe<string>): Maybe<string> {
  return input?.toLocaleLowerCase();
}

export function splitCommaSeparatedString(input: CommaSeparatedString<string>): string[];
export function splitCommaSeparatedString<T = unknown>(input: CommaSeparatedString<T>, mapFn: MapStringFn<T>): T[];
export function splitCommaSeparatedString<T = unknown>(input: CommaSeparatedString<T>, mapFn: MapStringFn<T> = (x) => x as unknown as T): T[] {
  const splits = input.split(',');
  return splits.map(x => mapFn(x.trim()));
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
    return (value > 0) ? `${prefix}${value}` : `${value}`;
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
