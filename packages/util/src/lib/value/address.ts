import { Maybe } from './maybe.type';

/**
 * City name
 */
export type CityString = string;

/**
 * Full state name
 */
export type StateString = string;

/**
 * State code
 */
export type StateCodeString = string;

/**
 * Full country name
 */
export type CountryString = string;

/**
 * Country code
 */
export type CountryCodeString = string;

export type AddressLineString = string;
export type ZipCodeString = string;

/**
 * Basic US Address that has 2 lines, a city, state, and zip code.
 */
export interface UnitedStatesAddress {
  line1: AddressLineString;
  line2?: AddressLineString;
  city: CityString;
  state: StateString | StateCodeString;
  zip: ZipCodeString;
}

/**
 * Returns true if the input address is completely configured and not missing any info.
 *
 * @param input
 * @returns
 */
export function isCompleteUnitedStatesAddress(input: Maybe<UnitedStatesAddress>): boolean {
  return input != null ? Boolean(input.line1 && input.city && input.state && input.zip) : false;
}

/**
 * Regex expression for all US states and territories.
 */
export const US_STATE_CODE_STRING_REGEX = /^((A[LKSZR])|(C[AOT])|(D[EC])|(F[ML])|(G[AU])|(HI)|(I[DLNA])|(K[SY])|(LA)|(M[EHDAINSOT])|(N[EVHJMYCD])|(MP)|(O[HKR])|(P[WAR])|(RI)|(S[CD])|(T[NX])|(UT)|(V[TIA])|(W[AVIY]))$/;

export function isUsStateCodeString(input: string): boolean {
  return US_STATE_CODE_STRING_REGEX.test(input);
}

/**
 * Simple regex expression for zip codes.
 *
 * Credit to:
 *
 * https://stackoverflow.com/a/19844362
 */
export const ZIP_CODE_STRING_REGEX = /^[a-z0-9][a-z0-9\- ]{0,10}[a-z0-9]$/;
