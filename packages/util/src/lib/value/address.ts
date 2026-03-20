import { filterEmptyArrayValues } from '../array/array.value';
import { type Maybe } from './maybe.type';

/**
 * City name string (e.g. "San Antonio").
 */
export type CityString = string;

/**
 * Full state name string (e.g. "Texas").
 */
export type StateString = string;

/**
 * Two-letter US state code (e.g. "TX").
 */
export type StateCodeString = string;

/**
 * Full country name string (e.g. "United States").
 */
export type CountryString = string;

/**
 * Country code string (e.g. "US").
 */
export type CountryCodeString = string;

/**
 * A single line in a street address.
 */
export type AddressLineString = string;

/**
 * Postal/zip code string.
 */
export type ZipCodeString = string;

/**
 * Basic US address with two address lines, city, state, and zip code.
 */
export interface UnitedStatesAddress {
  /**
   * Primary street address line.
   */
  line1: AddressLineString;
  /**
   * Secondary address line (apartment, suite, etc.).
   */
  line2?: AddressLineString;
  /**
   * City name.
   */
  city: CityString;
  /**
   * State name or two-letter state code.
   */
  state: StateString | StateCodeString;
  /**
   * Postal/zip code.
   */
  zip: ZipCodeString;
}

/**
 * Extends {@link UnitedStatesAddress} with optional contact information for display purposes,
 * such as a recipient name and phone number.
 */
export interface UnitedStatesAddressWithContact extends UnitedStatesAddress {
  /**
   * Contact name associated with this address.
   */
  name?: string;
  /**
   * Phone number associated with this address.
   */
  phone?: string;
}

/**
 * Formats a {@link UnitedStatesAddress} or {@link UnitedStatesAddressWithContact} into a human-readable multi-line string.
 *
 * Empty or undefined fields are omitted. If the input includes contact fields (name, phone), they appear at the top.
 * Returns `undefined` if no meaningful parts are present.
 *
 * @param input - the address to format
 * @param addLinebreaks - whether to join parts with newlines (default `true`) or concatenate them directly
 * @returns the formatted address string, or `undefined` if no meaningful parts are present
 */
export function unitedStatesAddressString(input: Maybe<Partial<UnitedStatesAddress | UnitedStatesAddressWithContact>>, addLinebreaks = true): Maybe<string> {
  const { name, phone, line1, line2, zip, state, city } = (input ?? {}) as Partial<UnitedStatesAddressWithContact>;

  let address: Maybe<string>;

  const lineBreakLine = addLinebreaks ? '\n' : '';
  const parts: Maybe<string>[] = [];

  parts.push(name);
  parts.push(phone);
  parts.push(line1);
  parts.push(line2);

  if (city || state || zip) {
    if (city && (state || zip)) {
      parts.push(`${city}, ${state} ${zip}`);
    } else if (city) {
      parts.push(`${city}`);
    } else if (state || zip) {
      parts.push(`${state} ${zip}`);
    }
  }

  const nonEmptyParts = filterEmptyArrayValues(parts);

  if (nonEmptyParts.length > 0) {
    address = filterEmptyArrayValues(nonEmptyParts.map((x) => x.trim())).join(lineBreakLine);
  }

  return address;
}

/**
 * Checks whether the input address has all required fields populated (line1, city, state, zip).
 *
 * Useful for validating an address before submission or display.
 *
 * @param input - the address to validate
 * @returns `true` if all required fields (line1, city, state, zip) are populated
 *
 * @example
 * ```ts
 * const address: UnitedStatesAddress = {
 *   line1: 'hello world',
 *   city: 'San Antonio',
 *   state: 'TX',
 *   zip: '78216'
 * };
 *
 * isCompleteUnitedStatesAddress(address);
 * // true
 * ```
 */
export function isCompleteUnitedStatesAddress(input: Maybe<UnitedStatesAddress>): boolean {
  return input != null ? Boolean(input.line1 && input.city && input.state && input.zip) : false;
}

/**
 * Regex that matches valid two-letter US state and territory codes (uppercase only).
 *
 * Includes all 50 states plus DC, PR, GU, AS, MP, VI, FM, MH, and PW.
 */
export const US_STATE_CODE_STRING_REGEX = /^((A[LKSZR])|(C[AOT])|(D[EC])|(F[ML])|(G[AU])|(HI)|(I[DLNA])|(K[SY])|(LA)|(M[EHDAINSOT])|(N[EVHJMYCD])|(MP)|(O[HKR])|(P[WAR])|(RI)|(S[CD])|(T[NX])|(UT)|(V[TIA])|(W[AVIY]))$/;

/**
 * Tests whether the input string is a valid two-letter US state or territory code.
 *
 * Only matches uppercase codes; lowercase input returns `false`.
 *
 * @param input - the string to test
 * @returns `true` if the input matches a valid US state or territory code
 *
 * @example
 * ```ts
 * isUsStateCodeString('TX');
 * // true
 *
 * isUsStateCodeString('XX');
 * // false
 * ```
 */
export function isUsStateCodeString(input: string): boolean {
  return US_STATE_CODE_STRING_REGEX.test(input);
}

/**
 * Simple regex for validating postal/zip codes.
 *
 * Matches alphanumeric codes between 2 and 12 characters, allowing hyphens and spaces in the middle.
 *
 * Credit: https://stackoverflow.com/a/19844362
 */
export const ZIP_CODE_STRING_REGEX = /^[a-z0-9][a-z0-9\- ]{0,10}[a-z0-9]$/;
