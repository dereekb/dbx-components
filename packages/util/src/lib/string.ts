import { MapStringFn } from "./map/map";
import { Maybe } from "./value";

/**
 * Represents a string that is made up of comma-separated values.
 * 
 * I.E. 0,1,2
 */
export type CommaSeparatedString<T = any> = string;

export function caseInsensitiveString(input: string): string;
export function caseInsensitiveString(input: undefined): undefined;
export function caseInsensitiveString(input: Maybe<string>): Maybe<string>;
export function caseInsensitiveString(input: any): any {
  return input?.toLocaleLowerCase();
}

export function splitCommaSeparatedString(input: CommaSeparatedString<string>): string[];
export function splitCommaSeparatedString<T = any>(input: CommaSeparatedString<T>, mapFn: MapStringFn<T>): T[];
export function splitCommaSeparatedString<T = any>(input: CommaSeparatedString<T>, mapFn: MapStringFn<T> = (x) => x as any): T[] {
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
