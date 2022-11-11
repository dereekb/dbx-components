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

export const US_STATE_CODE_STRING_REGEX = /^((A[LKSZR])|(C[AOT])|(D[EC])|(F[ML])|(G[AU])|(HI)|(I[DLNA])|(K[SY])|(LA)|(M[EHDAINSOT])|(N[EVHJMYCD])|(MP)|(O[HKR])|(P[WAR])|(RI)|(S[CD])|(T[NX])|(UT)|(V[TIA])|(W[AVIY]))$/;

export function isUsStateCodeString(input: string): boolean {
  return US_STATE_CODE_STRING_REGEX.test(input);
}
