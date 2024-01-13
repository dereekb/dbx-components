import { type ArrayOrValue, asArray } from '../array/array';
import { type Maybe } from '../value/maybe.type';
import { type MapSameFunction } from '../value/map';
import { replaceCharacterAtIndexWith, splitStringAtIndex } from './char';

export type ReplaceStringsFunction = MapSameFunction<string>;

export interface ReplaceStringsConfig {
  /**
   * Strings to target/replace.
   */
  replace: ArrayOrValue<string>;
  /**
   * Value to replace all recurrences with.
   */
  replaceWith: string;
}

export function replaceStringsFunction(config: ReplaceStringsConfig) {
  const { replace: replaceInput, replaceWith } = config;
  const replaceRegexString = findStringsRegexString(replaceInput);
  const replaceRegex = new RegExp(replaceRegexString, 'g');
  return (input: string) => input.replace(replaceRegex, replaceWith);
}

export const REGEX_SPECIAL_CHARACTERS = ['\\', '^', '$', '.', '|', '?', '*', '+', '(', ')', '[', ']', '{', '}'];
export const REGEX_SPECIAL_CHARACTERS_SET = new Set(REGEX_SPECIAL_CHARACTERS);

/**
 * Creates an escaped regex string joined with or values that finds all of the input values.
 *
 * @param find
 */
export function findStringsRegexString(find: ArrayOrValue<string>): string {
  const input = asArray(find);
  const escapedInput = input.map(escapeStringForRegex);
  return escapedInput.join('|');
}

/**
 * Escapes the input string to be usable in a Regex value.
 *
 * For instance, 'hello.world' will be escaped to be 'hello\.world'
 *
 * @param input
 */
export function escapeStringForRegex(input: string): string {
  /**
   * index of all occurences in the input to replace/merge together.
   */
  const occurrences = findAllCharacterOccurences(REGEX_SPECIAL_CHARACTERS_SET, input);

  let result: string;

  function escapeCharacter(char: string): string {
    return `\\${char}`;
  }

  switch (occurrences.length) {
    case 0:
      result = input;
      break;
    case 1:
      const charToReplace = input[occurrences[0]];
      result = replaceCharacterAtIndexWith(input, occurrences[0], escapeCharacter(charToReplace)); //Add an escape to the character
      break;
    default:
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

  return result;
}

export type FindAllCharacterOccurencesFunction = (input: string, max?: Maybe<number>) => number[];

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
 * First all occurences of the characters from the set in the input string.
 *
 * @param set
 * @param input
 * @returns
 */
export function findAllCharacterOccurences(set: Set<string>, input: string, max?: number): number[] {
  return findAllCharacterOccurencesFunction(set)(input, max);
}

/**
 * First the first occurence of a character from the set in the input string.
 *
 * @param set
 * @param input
 * @returns
 */
export function findFirstCharacterOccurence(set: Set<string>, input: string): Maybe<number> {
  return findAllCharacterOccurences(set, input, 1)[0];
}

export type SplitStringAtFirstCharacterOccurenceFunction = (input: string) => [string, string | undefined];

/**
 * Splits the string into two parts at the first occurence of a string or any string in the set.
 *
 * @param set
 * @param input
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
 * Splits the string into two parts at the first occurence of a string or any string in the set.
 *
 * @param set
 * @param input
 */
export function keepCharactersAfterFirstCharacterOccurenceFunction(findCharacters: string | Set<string>): KeepCharactersAfterFirstCharacterOccurenceFunction {
  const splitStringAtFirstCharacterOccurence = splitStringAtFirstCharacterOccurenceFunction(findCharacters);
  return (input: string) => splitStringAtFirstCharacterOccurence(input)[1] ?? '';
}

/**
 * Keeps all characters from the input string after the first character occurence from findCharacters input.
 *
 * @param input
 * @param splitAt
 * @returns
 */
export function keepCharactersAfterFirstCharacterOccurence(input: string, findCharacters: string | Set<string>): string {
  return keepCharactersAfterFirstCharacterOccurenceFunction(findCharacters)(input);
}

/**
 * Removes all characters from the input string after the first character occurence pre-determined by the function.
 */
export type RemoveCharactersAfterFirstCharacterOccurenceFunction = (input: string) => string;

/**
 * Splits the string into two parts at the first occurence of a string or any string in the set.
 *
 * @param set
 * @param input
 */
export function removeCharactersAfterFirstCharacterOccurenceFunction(findCharacters: string | Set<string>): RemoveCharactersAfterFirstCharacterOccurenceFunction {
  const splitStringAtFirstCharacterOccurence = splitStringAtFirstCharacterOccurenceFunction(findCharacters);
  return (input: string) => splitStringAtFirstCharacterOccurence(input)[0];
}

/**
 * Removes all characters from the input string after the first character occurence from findCharacters input.
 *
 * @param input
 * @param splitAt
 * @returns
 */
export function removeCharactersAfterFirstCharacterOccurence(input: string, findCharacters: string | Set<string>): string {
  return removeCharactersAfterFirstCharacterOccurenceFunction(findCharacters)(input);
}
