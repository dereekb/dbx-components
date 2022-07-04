import { ArrayOrValue, asArray } from '@dereekb/util';
import { MapSameFunction } from '../value/map';
import { replaceCharacterAtIndexWith } from './char';

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
  const occurrences: number[] = [];

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (REGEX_SPECIAL_CHARACTERS_SET.has(char)) {
      occurrences.push(i);
    }
  }

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
