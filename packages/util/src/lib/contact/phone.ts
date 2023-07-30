import { removeCharactersAfterFirstCharacterOccurenceFunction, splitStringAtFirstCharacterOccurenceFunction } from '../string/replace';
import { Maybe } from '../value/maybe.type';

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
 * E164PhoneNumber regex validator.
 *
 * Requires the + to be provided.
 */
export const E164PHONE_NUMBER_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * Returns true if the input phone number is a valid E164PHONE_NUMBER_REGEX value.
 *
 * @param input
 * @returns
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
 * E164PhoneNumber regex validator with an optional extension.
 *
 * Requires the + to be provided.
 */
export const E164PHONE_NUMBER_WITH_OPTIONAL_EXTENSION_REGEX = /^\+[1-9]\d{1,14}(#\d{1,6})?$/;

/**
 * E164PhoneNumber regex validator with an extension.
 *
 * Requires the + to be provided.
 */
export const E164PHONE_NUMBER_WITH_EXTENSION_REGEX = /^\+[1-9]\d{1,14}(#\d{1,6})$/;

/**
 * Returns true if the input phone number is a valid E164PHONE_NUMBER_WITH_EXTENSION_REGEX value.
 *
 * @param input
 * @returns
 */
export function isE164PhoneNumberWithExtension(input: string): input is E164PhoneNumberWithExtension {
  return E164PHONE_NUMBER_WITH_EXTENSION_REGEX.test(input);
}

export const PHONE_EXTENSION_NUMBER_REGEX = /^\d{1,6}$/;

/**
 * Returns true if the input is a valid phone number extension.
 *
 * @param input
 * @returns
 */
export function isValidPhoneExtensionNumber(input: string): input is PhoneExtensionNumber {
  return PHONE_EXTENSION_NUMBER_REGEX.test(input);
}

/**
 * Removes the extension characters from the input phone number.
 */
export const removeExtensionFromPhoneNumber = removeCharactersAfterFirstCharacterOccurenceFunction('#') as (input: PhoneNumber | E164PhoneNumberWithOptionalExtension) => E164PhoneNumber;

export interface E164PhoneNumberExtensionPair {
  number: E164PhoneNumber;
  extension?: Maybe<PhoneExtensionNumber>;
}

const e164PhoneNumberExtensionPairSplitterFunction = splitStringAtFirstCharacterOccurenceFunction('#');

export function e164PhoneNumberExtensionPair(input: PhoneNumber | E164PhoneNumberWithOptionalExtension): E164PhoneNumberExtensionPair {
  const split = e164PhoneNumberExtensionPairSplitterFunction(input);

  return {
    number: split[0] as E164PhoneNumber,
    extension: split[1]
  };
}

export function e164PhoneNumberFromE164PhoneNumberExtensionPair(input: E164PhoneNumberExtensionPair): E164PhoneNumberWithOptionalExtension {
  return input.extension ? `${input.number}#${input.extension}` : input.number;
}
