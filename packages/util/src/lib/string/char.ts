import { type ArrayOrValue } from '../array/array';
import { type DecisionFunction } from '../value/decision';

/**
 * Result describing the first and last index positions of a character within a string.
 */
export interface FirstAndLastCharacterOccurrence {
  /**
   * Index of the first occurrence, or -1 if the character was not found.
   */
  readonly first: number | -1;
  /**
   * Index of the last occurrence, or -1 if the character was not found.
   */
  readonly last: number | -1;
  /**
   * Total number of occurrences.
   */
  readonly occurences: number;
}

/**
 * Finds the first and last occurrence of a single character within the input string.
 *
 * @param input - string to search through
 * @param find - single character to find
 * @returns an object containing the first index, last index, and total occurrence count
 * @throws Error if find is not exactly one character long
 */
export function firstAndLastCharacterOccurrence(input: string, find: string): FirstAndLastCharacterOccurrence {
  let first: number = -1;
  let last: number = -1;
  let occurences = 0;

  if (find.length !== 1) {
    throw new Error('firstAndLastCharacterOccurrence() expects a single character as find input.');
  }

  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === find) {
      if (first === -1) {
        first = i;
      } else {
        last = i;
      }

      occurences += 1;
    }
  }

  if (first !== -1 && last === -1) {
    last = first;
  }

  return {
    first,
    last,
    occurences
  };
}

/**
 * Checks whether the input string contains the given substring.
 *
 * @param input - string to search within
 * @param find - substring to search for
 * @returns true if the substring is found within the input
 */
export function stringContains(input: string, find: string): boolean {
  return input.indexOf(find) !== -1;
}

/**
 * Function that replaces the last character with the configured replacement string if it is any of the configured values.
 */
export type ReplaceLastCharacterIfIsFunction = (input: string) => string;

/**
 * Creates a function that replaces the last character of a string with the replacement string
 * if that character matches any of the specified values.
 *
 * @param replacement - string to substitute for the last character
 * @param is - character(s) that trigger the replacement
 * @returns a function that conditionally replaces the last character
 */
export function replaceLastCharacterIfIsFunction(replacement: string, is: ArrayOrValue<string>): ReplaceLastCharacterIfIsFunction {
  const matches = new Set(is);
  return (input: string) => {
    return replaceLastCharacterIf(input, replacement, (x) => matches.has(x));
  };
}

/**
 * Replaces the last character of a string with the replacement if the decision function returns true for that character.
 *
 * @param input - string to potentially modify
 * @param replacement - string to substitute for the last character
 * @param decision - function that determines whether the last character should be replaced
 * @returns the modified string, or the original if the decision is false or the string is empty
 */
export function replaceLastCharacterIf(input: string, replacement: string, decision: DecisionFunction<string>): string {
  return input.length > 0 ? replaceCharacterAtIndexIf(input, input.length - 1, replacement, decision) : input;
}

/**
 * Replaces the character at the given index with the replacement string if the decision function returns true for that character.
 *
 * @param input - string to potentially modify
 * @param index - character index to evaluate
 * @param replacement - string to substitute at the index
 * @param decision - function that determines whether the character should be replaced
 * @returns the modified string, or the original if the decision is false
 */
export function replaceCharacterAtIndexIf(input: string, index: number, replacement: string, decision: DecisionFunction<string>): string {
  if (decision(input[index])) {
    return replaceCharacterAtIndexWith(input, index, replacement);
  } else {
    return input;
  }
}

/**
 * Replaces the character at the given index with the replacement string.
 *
 * @param input - string to modify
 * @param index - character index to replace
 * @param replacement - string to substitute at the index
 * @returns the string with the character at the index replaced
 */
export function replaceCharacterAtIndexWith(input: string, index: number, replacement: string): string {
  const [head, tail] = splitStringAtIndex(input, index, false);
  return head + replacement + tail;
}

/**
 * Splits the input string into two parts at the given character index.
 *
 * @param input - string to split
 * @param index - character index at which to split
 * @param inclusive - if true, the character at the index is included in the tail; if false (default), it is excluded from both parts
 * @returns a tuple of [head, tail] substrings
 */
export function splitStringAtIndex(input: string, index: number, inclusive = false): [string, string] {
  const head = input.substring(0, index);
  const tail = input.substring(index + (inclusive ? 0 : 1));
  return [head, tail];
}

/**
 * Special UTF-8 character that is the starting character.
 *
 * Example usage is in Firebase string queries to restrict the string search to a specific string.
 */
export const UTF_8_START_CHARACTER = '\u0000';

/**
 * Special UTF-8 character that is very high.
 *
 * Example usage is in Firebase string queries as wildcards for searching:
 *
 * https://firebase.google.com/docs/database/rest/retrieve-data#range-queries
 */
export const UTF_PRIVATE_USAGE_AREA_START = '\uf8ff';

/**
 * Creates a lookup record mapping each character in the input string to its index position.
 * In case of duplicate characters, the last occurrence's index is used.
 *
 * @param chars - string whose characters become keys in the record
 * @returns a record mapping each character to its index in the input string
 */
export function stringCharactersToIndexRecord(chars: string): Record<string, number> {
  const record: Record<string, number> = {} as Record<string, number>;

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    record[char] = i;
  }

  return record;
}
