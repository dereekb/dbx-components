export interface FirstAndLastCharacterOccurrence {
  readonly first: number | -1;
  readonly last: number | -1;
  /**
   * Total number of occurrences.
   */
  readonly occurences: number;
}

/**
 * Find the first and last occurence of the input character in the input string.
 *
 * @param input string to find the character occurrences
 * @param find character to find
 * @returns
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
 * Replaces the character at the given index with the replacement string.
 *
 * @param input
 * @param index
 * @param replacement
 * @returns
 */
export function replaceCharacterAtIndexWith(input: string, index: number, replacement: string): string {
  const [head, tail] = splitStringAtIndex(input, index, false);
  return head + replacement + tail;
}

/**
 * Splits the input string at the given character index.
 *
 * @param input
 * @param index
 * @param replacement
 * @returns
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
