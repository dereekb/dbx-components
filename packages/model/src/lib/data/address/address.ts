import { US_STATE_CODE_STRING_REGEX } from '@dereekb/util';
import { type } from 'arktype';

/**
 * Maximum character length for address line fields (line1, line2).
 */
export const ADDRESS_LINE_MAX_LENGTH = 50;

/**
 * Maximum character length for city names.
 */
export const ADDRESS_CITY_MAX_LENGTH = 80;

/**
 * Maximum character length for full state names (e.g., "Texas").
 */
export const ADDRESS_STATE_MAX_LENGTH = 30;

/**
 * Maximum character length for two-letter state codes (e.g., "TX").
 */
export const ADDRESS_STATE_CODE_MAX_LENGTH = 2;

/**
 * Maximum character length for ZIP codes, accommodating ZIP+4 format (e.g., "77834-1234").
 */
export const ADDRESS_ZIP_MAX_LENGTH = 11;

/**
 * Maximum character length for country names.
 */
export const ADDRESS_COUNTRY_MAX_LENGTH = 80;

/**
 * Base ArkType schema for United States address fields without the state.
 */
const baseUnitedStatesAddressType = type({
  line1: `0 < string <= ${ADDRESS_LINE_MAX_LENGTH}`,
  'line2?': `string <= ${ADDRESS_LINE_MAX_LENGTH}`,
  city: `0 < string <= ${ADDRESS_CITY_MAX_LENGTH}`,
  zip: [/^\d{5}(-\d{4})?$/, '&', `string <= ${ADDRESS_ZIP_MAX_LENGTH}`] as const
});

/**
 * ArkType schema for a United States address with a two-letter state code (e.g., "TX").
 */
export const unitedStatesAddressWithStateCodeType = baseUnitedStatesAddressType.merge({
  state: [US_STATE_CODE_STRING_REGEX, '&', `${ADDRESS_STATE_CODE_MAX_LENGTH} <= string <= ${ADDRESS_STATE_CODE_MAX_LENGTH}`] as const
});

export type UnitedStatesAddressWithStateCodeParams = typeof unitedStatesAddressWithStateCodeType.infer;

/**
 * ArkType schema for a United States address with a full state name (e.g., "Texas").
 */
export const unitedStatesAddressWithStateStringType = baseUnitedStatesAddressType.merge({
  state: `0 < string <= ${ADDRESS_STATE_MAX_LENGTH}`
});

export type UnitedStatesAddressWithStateStringParams = typeof unitedStatesAddressWithStateStringType.infer;
