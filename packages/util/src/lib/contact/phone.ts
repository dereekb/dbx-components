import { removeCharactersAfterFirstCharacterOccurenceFunction, splitStringAtFirstCharacterOccurenceFunction } from '../string/replace';
import { type Maybe } from '../value/maybe.type';

/**
 * Phone number string input. No format specified.
 *
 * Examples:
 * - 4567890
 * - 123-456-7890
 * - (123) 456-7890
 * - 1234567890
 * - +1234567890
 * - +1-555-555-5555
 * - 2345678;ext=123
 *
 * @semanticType
 * @semanticTopic phone
 * @semanticTopic contact
 * @semanticTopic string
 */
export type PhoneNumber = string;

/**
 * 1-6 digit extension number
 *
 * @semanticType
 * @semanticTopic phone
 * @semanticTopic contact
 * @semanticTopic string
 */
export type PhoneExtensionNumber = string;

/**
 * E.164 Standardized Phone Number. Always starts with a +
 *
 * https://en.wikipedia.org/wiki/E.164
 */
export type E164PhoneNumber = `+${PhoneNumber}`;

/**
 * Regular expression for validating E.164 phone numbers.
 * Validates numbers that start with a + followed by 7-15 digits.
 * The first digit after the + must be 1-9 (not 0).
 *
 * Requires the + to be provided.
 */
export const E164PHONE_NUMBER_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * Validates if the input string is a valid E.164 phone number.
 *
 * @param input - The phone number string to validate
 * @param allowExtension - If true, allows an extension in the format +number#extension
 * @returns True if the input is a valid E.164 phone number
 */
export function isE164PhoneNumber(input: string, allowExtension = true): input is E164PhoneNumber {
  return (allowExtension ? E164PHONE_NUMBER_WITH_OPTIONAL_EXTENSION_REGEX : E164PHONE_NUMBER_REGEX).test(input);
}

/**
 * E.164 Standardized Phone Number with an extension number. Always starts with a +. The extension is separated with a #.
 *
 * https://en.wikipedia.org/wiki/E.164
 */
export type E164PhoneNumberWithExtension = `+${PhoneNumber}#${PhoneExtensionNumber}`;

/**
 * E.164 Standardized Phone Number that may have an extension with it.
 */
export type E164PhoneNumberWithOptionalExtension = E164PhoneNumber | E164PhoneNumberWithExtension;

/**
 * Regular expression for validating E.164 phone numbers with an optional extension.
 * Validates numbers with 7-15 digits in the format +number or +number#extension.
 * The extension part is 1-6 digits following a # character.
 *
 * Requires the + to be provided.
 */
export const E164PHONE_NUMBER_WITH_OPTIONAL_EXTENSION_REGEX = /^\+[1-9]\d{6,14}(#\d{1,6})?$/;

/**
 * Regular expression for validating E.164 phone numbers that must include an extension.
 * Validates numbers with 7-15 digits strictly in the format +number#extension.
 * The extension part is 1-6 digits following a # character.
 *
 * Requires the + to be provided and the extension part.
 */
export const E164PHONE_NUMBER_WITH_EXTENSION_REGEX = /^\+[1-9]\d{6,14}(#\d{1,6})$/;

/**
 * Validates if the input string is a valid E.164 phone number with an extension.
 * The phone number must be in the format +number#extension.
 *
 * @param input - The phone number string to validate
 * @returns True if the input is a valid E.164 phone number with extension
 */
export function isE164PhoneNumberWithExtension(input: string): input is E164PhoneNumberWithExtension {
  return E164PHONE_NUMBER_WITH_EXTENSION_REGEX.test(input);
}

/**
 * Regular expression for validating phone extension numbers.
 * Extension must be 1-6 digits with no other characters.
 */
export const PHONE_EXTENSION_NUMBER_REGEX = /^\d{1,6}$/;

/**
 * Validates if the input string is a valid phone extension number.
 * Valid extensions are 1-6 digits with no other characters.
 *
 * @param input - The extension string to validate
 * @returns True if the input is a valid phone extension number
 */
export function isValidPhoneExtensionNumber(input: string): input is PhoneExtensionNumber {
  return PHONE_EXTENSION_NUMBER_REGEX.test(input);
}

/**
 * Removes the extension portion from a phone number.
 * If the phone number contains a # character, everything after it is removed.
 *
 * @param input - The phone number with or without extension
 * @returns The phone number with any extension removed
 */
export const removeExtensionFromPhoneNumber = removeCharactersAfterFirstCharacterOccurenceFunction('#') as (input: PhoneNumber | E164PhoneNumberWithOptionalExtension) => E164PhoneNumber;

/**
 * Interface representing a phone number and its optional extension as separate parts.
 */
export interface E164PhoneNumberExtensionPair {
  number: E164PhoneNumber;
  extension?: Maybe<PhoneExtensionNumber>;
}

/**
 * Function that splits a phone number string at the first # character.
 * Used to separate the main phone number from its extension.
 */
const e164PhoneNumberExtensionPairSplitterFunction = splitStringAtFirstCharacterOccurenceFunction('#');

/**
 * Splits a phone number into its main number and extension components.
 * If the input contains a # character, everything before is the number and everything after is the extension.
 *
 * @param input - The phone number string to split
 * @returns An object containing the number and optional extension
 */
export function e164PhoneNumberExtensionPair(input: PhoneNumber | E164PhoneNumberWithOptionalExtension): E164PhoneNumberExtensionPair {
  const split = e164PhoneNumberExtensionPairSplitterFunction(input);

  return {
    number: split[0] as E164PhoneNumber,
    extension: split[1]
  };
}

/**
 * Combines a phone number and optional extension into a single string.
 * If an extension is provided, it will be appended with a # separator.
 *
 * @param input - An object containing the phone number and optional extension
 * @returns A formatted phone number string with optional extension
 */
export function e164PhoneNumberFromE164PhoneNumberExtensionPair(input: E164PhoneNumberExtensionPair): E164PhoneNumberWithOptionalExtension {
  return input.extension ? `${input.number}#${input.extension}` : input.number;
}

/**
 * Regex matching common phone number formatting characters to strip: parentheses, hyphens, spaces, and dots.
 */
const PHONE_NUMBER_FORMATTING_CHARACTERS_REGEX = /[() \-.]/g;

/**
 * Attempts to convert a raw phone number string into a valid {@link E164PhoneNumber}.
 *
 * Strips common formatting characters (parentheses, hyphens, spaces, dots), then checks
 * if the result is already valid E.164. If not, prepends the given country code and
 * validates again.
 *
 * @param input - A raw phone number string, possibly with formatting (e.g. `'(720)6620850'`, `'720-662-0850'`)
 * @param defaultCountryCode - The country calling code to prepend if the number lacks one (default: `'1'` for US/Canada)
 * @returns The corrected {@link E164PhoneNumber}, or `undefined` if the input cannot be converted
 *
 * @example
 * ```typescript
 * tryConvertToE164PhoneNumber('(720)6620850');       // '+17206620850'
 * tryConvertToE164PhoneNumber('720-662-0850');        // '+17206620850'
 * tryConvertToE164PhoneNumber('+17206620850');        // '+17206620850'
 * tryConvertToE164PhoneNumber('7206620850', '44');    // '+447206620850'
 * tryConvertToE164PhoneNumber('abc');                 // undefined
 * ```
 */
export function tryConvertToE164PhoneNumber(input: string, defaultCountryCode = '1'): Maybe<E164PhoneNumber> {
  const stripped = input.replaceAll(PHONE_NUMBER_FORMATTING_CHARACTERS_REGEX, '');
  let result: Maybe<E164PhoneNumber>;

  if (isE164PhoneNumber(stripped, false)) {
    result = stripped;
  } else {
    const withCountryCode = `+${defaultCountryCode}${stripped}` as E164PhoneNumber;

    if (isE164PhoneNumber(withCountryCode, false)) {
      result = withCountryCode;
    }
  }

  return result;
}
