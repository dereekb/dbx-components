import { type ArrayOrValue, asArray } from '../array/array';
import { type Maybe } from '../value/maybe.type';
import { type MapSameFunction } from '../value/map';
import { replaceCharacterAtIndexWith, splitStringAtIndex } from './char';

/**
 * Function that replaces target substrings within an input string.
 */
export type ReplaceStringsFunction = MapSameFunction<string>;

/**
 * Configuration for creating a {@link ReplaceStringsFunction}.
 */
export interface ReplaceStringsConfig {
  /**
   * Strings to target/replace.
   */
  readonly replace: ArrayOrValue<string>;
  /**
   * Value to replace all recurrences with.
   */
  readonly replaceWith: string;
}

/**
 * Creates a function that replaces all occurrences of the configured target strings with a replacement value.
 *
 * @param config - Configuration specifying strings to find and the replacement value.
 * @returns A function that performs the configured replacements on an input string.
 */
export function replaceStringsFunction(config: ReplaceStringsConfig) {
  const { replace: replaceInput, replaceWith } = config;
  const replaceRegexString = findStringsRegexString(replaceInput);
  const replaceRegex = new RegExp(replaceRegexString, 'g');
  return (input: string) => input.replace(replaceRegex, replaceWith);
}

/**
 * Array of characters that have special meaning in regular expressions and need escaping.
 */
export const REGEX_SPECIAL_CHARACTERS = ['\\', '^', '$', '.', '|', '?', '*', '+', '(', ')', '[', ']', '{', '}'];

/**
 * Set of regex special characters for efficient lookup.
 */
export const REGEX_SPECIAL_CHARACTERS_SET = new Set(REGEX_SPECIAL_CHARACTERS);

/**
 * Creates an escaped regex string that matches any of the input values, joined with the OR (`|`) operator.
 *
 * @param find - One or more strings to create a matching regex pattern for.
 * @returns A regex-compatible string with special characters escaped and values joined by `|`.
 */
export function findStringsRegexString(find: ArrayOrValue<string>): string {
  const input = asArray(find);
  const escapedInput = input.map(escapeStringForRegex);
  return escapedInput.join('|');
}

/**
 * Configuration for creating an {@link EscapeStringCharactersFunction}.
 */
export interface EscapeStringCharactersFunctionConfig {
  /**
   * The set of characters to find and use the escapeCharacter() function on.
   *
   * Targets should be individual characters. Strings of more than one character are ignored.
   */
  readonly escapeTargets: Iterable<string> | Set<string>;
  /**
   * Escapes the target character. Can return any string to properly "escape" the character.
   *
   * @param char
   * @returns
   */
  readonly escapeCharacter: (char: string) => string;
}

/**
 * Function that properly "escapes" specific characters in a string.
 *
 * How the characters are escaped is determined by the function.
 */
export type EscapeStringCharactersFunction = (input: string) => string;

/**
 * Creates an {@link EscapeStringCharactersFunction} that escapes specific characters in a string using the configured escape strategy.
 *
 * @param config - Configuration specifying which characters to escape and how to escape them.
 * @returns A function that escapes the configured characters in any input string.
 */
export function escapeStringCharactersFunction(config: EscapeStringCharactersFunctionConfig): EscapeStringCharactersFunction {
  const { escapeTargets: inputEscapeTargets, escapeCharacter } = config;
  const escapeTargets = inputEscapeTargets instanceof Set ? inputEscapeTargets : new Set(inputEscapeTargets);

  return (input: string) => {
    /**
     * Find index of all occurences in the input to replace/merge together.
     */
    const occurrences = findAllCharacterOccurences(escapeTargets, input);

    let result: string;

    switch (occurrences.length) {
      case 0:
        result = input;
        break;
      case 1: {
        const charToReplace = input[occurrences[0]];
        result = replaceCharacterAtIndexWith(input, occurrences[0], escapeCharacter(charToReplace)); //Add an escape to the character
        break;
      }
      default: {
        const parts: string[] = [];
        const endAt = occurrences.length;

        let start: number = 0;
        let occurrence: number = 0;

        for (let i = 0; i < endAt; i += 1) {
          occurrence = occurrences[i];

          const char = input[occurrence];
          const sub = input.substring(start, occurrence);
          const part = sub + escapeCharacter(char);
          parts.push(part);

          start = occurrence + 1;
        }

        // add in the last substring
        parts.push(input.substring(start));

        // join all parts together
        result = parts.join('');
        break;
      }
    }

    return result;
  };
}

/**
 * Escapes the input string so it can be safely used as a literal value in a regular expression.
 *
 * For instance, `'hello.world'` will be escaped to `'hello\\.world'`.
 *
 * @param input - The string to escape for regex use.
 * @returns The escaped string with all regex special characters prefixed with a backslash.
 */
export const escapeStringForRegex = escapeStringCharactersFunction({
  escapeTargets: REGEX_SPECIAL_CHARACTERS_SET,
  escapeCharacter(char: string): string {
    return `\\${char}`;
  }
});

/**
 * Function that finds all indices of characters from a pre-configured set within an input string.
 *
 * @param input - The string to search through.
 * @param max - Optional maximum number of occurrences to return.
 * @returns An array of zero-based indices where matching characters were found.
 */
export type FindAllCharacterOccurencesFunction = (input: string, max?: Maybe<number>) => number[];

/**
 * Creates a {@link FindAllCharacterOccurencesFunction} that searches for characters from the given set.
 *
 * @param characterSet - The set of characters to search for.
 * @returns A function that finds all occurrences of the configured characters in an input string.
 */
export function findAllCharacterOccurencesFunction(characterSet: Set<string>): FindAllCharacterOccurencesFunction {
  return (input: string, maxToReturn?: Maybe<number>) => {
    const max = maxToReturn ?? Number.MAX_SAFE_INTEGER;
    const occurrences: number[] = [];

    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];

      if (characterSet.has(char)) {
        occurrences.push(i);

        // return if at the max number of occurences
        if (occurrences.length >= max) {
          break;
        }
      }
    }

    return occurrences;
  };
}

/**
 * Finds all indices of characters from the set that appear in the input string.
 *
 * @param set - The set of characters to search for.
 * @param input - The string to search through.
 * @param max - Optional maximum number of occurrences to return.
 * @returns An array of zero-based indices where matching characters were found.
 */
export function findAllCharacterOccurences(set: Set<string>, input: string, max?: number): number[] {
  return findAllCharacterOccurencesFunction(set)(input, max);
}

/**
 * Finds the index of the first occurrence of any character from the set in the input string.
 *
 * @param set - The set of characters to search for.
 * @param input - The string to search through.
 * @returns The zero-based index of the first matching character, or `undefined` if none found.
 */
export function findFirstCharacterOccurence(set: Set<string>, input: string): Maybe<number> {
  return findAllCharacterOccurences(set, input, 1)[0];
}

/**
 * The result of splitting a string at the first character occurence.
 *
 * The first element is the string before the split character(s).
 * The second element is the string after the split character(s), or is undefined if no split occured.
 */
export type SplitStringAtFirstCharacterOccurenceResult = [string, string | undefined];

/**
 * Splits the input string at the configured split character(s).
 */
export type SplitStringAtFirstCharacterOccurenceFunction = (input: string) => SplitStringAtFirstCharacterOccurenceResult;

/**
 * Creates a function that splits a string into two parts at the first occurrence of any character in the configured set.
 *
 * @param splitAt - A single character or set of characters to split on.
 * @returns A function that splits input strings at the first matching character.
 */
export function splitStringAtFirstCharacterOccurenceFunction(splitAt: string | Set<string>): SplitStringAtFirstCharacterOccurenceFunction {
  return (input: string) => {
    const splitSet = typeof splitAt === 'string' ? new Set([splitAt]) : splitAt;
    const firstOccurence = findFirstCharacterOccurence(splitSet, input);
    let result: [string, string | undefined];

    if (firstOccurence != null) {
      result = splitStringAtIndex(input, firstOccurence, false);
    } else {
      result = [input, undefined];
    }

    return result;
  };
}

/**
 * Splits the input string into two parts at the first occurrence of any character in the split set.
 *
 * @param input - The string to split.
 * @param splitAt - A single character or set of characters to split on.
 * @returns A tuple of [before, after], where `after` is `undefined` if no split character was found.
 */
export function splitStringAtFirstCharacterOccurence(input: string, splitAt: string | Set<string>): [string, string | undefined] {
  return splitStringAtFirstCharacterOccurenceFunction(splitAt)(input);
}

/**
 * Keeps all characters from the input string after the first character occurence pre-determined by the function.
 *
 * If no trigger characters exist, returns an empty string.
 */
export type KeepCharactersAfterFirstCharacterOccurenceFunction = (input: string) => string;

/**
 * Creates a function that returns only the characters after the first occurrence of any character in the configured set.
 *
 * @param findCharacters - A single character or set of characters to search for.
 * @returns A function that extracts the substring after the first matching character, or an empty string if none found.
 */
export function keepCharactersAfterFirstCharacterOccurenceFunction(findCharacters: string | Set<string>): KeepCharactersAfterFirstCharacterOccurenceFunction {
  const splitStringAtFirstCharacterOccurence = splitStringAtFirstCharacterOccurenceFunction(findCharacters);
  return (input: string) => splitStringAtFirstCharacterOccurence(input)[1] ?? '';
}

/**
 * Returns only the characters after the first occurrence of any character from the find set.
 *
 * @param input - The string to search through.
 * @param findCharacters - A single character or set of characters to search for.
 * @returns The substring after the first matching character, or an empty string if none found.
 */
export function keepCharactersAfterFirstCharacterOccurence(input: string, findCharacters: string | Set<string>): string {
  return keepCharactersAfterFirstCharacterOccurenceFunction(findCharacters)(input);
}

/**
 * Removes all characters from the input string after the first character occurence pre-determined by the function.
 */
export type RemoveCharactersAfterFirstCharacterOccurenceFunction = (input: string) => string;

/**
 * Creates a function that removes all characters after (and including) the first occurrence of any character in the configured set.
 *
 * @param findCharacters - A single character or set of characters to search for.
 * @returns A function that truncates input strings at the first matching character.
 */
export function removeCharactersAfterFirstCharacterOccurenceFunction(findCharacters: string | Set<string>): RemoveCharactersAfterFirstCharacterOccurenceFunction {
  const splitStringAtFirstCharacterOccurence = splitStringAtFirstCharacterOccurenceFunction(findCharacters);
  return (input: string) => splitStringAtFirstCharacterOccurence(input)[0];
}

/**
 * Removes all characters after (and including) the first occurrence of any character from the find set.
 *
 * @param input - The string to truncate.
 * @param findCharacters - A single character or set of characters to search for.
 * @returns The substring before the first matching character, or the full string if none found.
 */
export function removeCharactersAfterFirstCharacterOccurence(input: string, findCharacters: string | Set<string>): string {
  return removeCharactersAfterFirstCharacterOccurenceFunction(findCharacters)(input);
}
