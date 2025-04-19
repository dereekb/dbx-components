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
 */
export type PhoneNumber = string;

/**
 * 1-6 digit extension number
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
 * Validates numbers that start with a + followed by 2-15 digits.
 * The first digit after the + must be 1-9 (not 0).
 *
 * Requires the + to be provided.
 */
export const E164PHONE_NUMBER_REGEX = /^\+[1-9]\d{1,14}$/;

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
 * Validates numbers in the format +number or +number#extension.
 * The extension part is 1-6 digits following a # character.
 *
 * Requires the + to be provided.
 */
export const E164PHONE_NUMBER_WITH_OPTIONAL_EXTENSION_REGEX = /^\+[1-9]\d{1,14}(#\d{1,6})?$/;

/**
 * Regular expression for validating E.164 phone numbers that must include an extension.
 * Validates numbers strictly in the format +number#extension.
 * The extension part is 1-6 digits following a # character.
 *
 * Requires the + to be provided and the extension part.
 */
export const E164PHONE_NUMBER_WITH_EXTENSION_REGEX = /^\+[1-9]\d{1,14}(#\d{1,6})$/;

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
