import { type AddressLineString, type CityString, type StateString, type StateCodeString, type ZipCodeString, type UnitedStatesAddress, US_STATE_CODE_STRING_REGEX, ZIP_CODE_STRING_REGEX } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
 * Abstract base class for United States address validation DTOs.
 *
 * Provides class-validator decorated fields for line1, line2, city, and zip,
 * leaving the state field to be defined by subclasses with different validation constraints.
 *
 * @example
 * ```typescript
 * // Use a concrete subclass like UnitedStatesAddressWithStateCodeParams
 * const address = new UnitedStatesAddressWithStateCodeParams();
 * address.line1 = '123 Main St';
 * address.city = 'Austin';
 * address.zip = '78701';
 * address.state = 'TX';
 * ```
 */
export abstract class AbstractUnitedStatesAddressWithoutStateParams {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ADDRESS_LINE_MAX_LENGTH)
  line1!: AddressLineString;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(ADDRESS_LINE_MAX_LENGTH)
  line2?: AddressLineString;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ADDRESS_CITY_MAX_LENGTH)
  city!: CityString;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @Matches(ZIP_CODE_STRING_REGEX)
  @MaxLength(ADDRESS_ZIP_MAX_LENGTH)
  zip!: ZipCodeString;
}

/**
 * United States address DTO that validates the state field as a two-letter state code.
 *
 * Uses regex matching to enforce the US state code format (e.g., "TX", "CA").
 *
 * @example
 * ```typescript
 * import { validate } from 'class-validator';
 *
 * const address = new UnitedStatesAddressWithStateCodeParams();
 * address.line1 = '123 Main St';
 * address.city = 'Austin';
 * address.zip = '78701';
 * address.state = 'TX';
 *
 * const errors = await validate(address);
 * // errors.length === 0
 * ```
 */
export class UnitedStatesAddressWithStateCodeParams extends AbstractUnitedStatesAddressWithoutStateParams implements UnitedStatesAddress {
  @Expose()
  @IsString()
  @Matches(US_STATE_CODE_STRING_REGEX)
  @MinLength(ADDRESS_STATE_CODE_MAX_LENGTH)
  @MaxLength(ADDRESS_STATE_CODE_MAX_LENGTH)
  state!: StateCodeString;
}

/**
 * United States address DTO that validates the state field as a full state name string.
 *
 * Accepts any non-empty string up to {@link ADDRESS_STATE_MAX_LENGTH} characters (e.g., "Texas", "California").
 *
 * @example
 * ```typescript
 * import { validate } from 'class-validator';
 *
 * const address = new UnitedStatesAddressWithStateStringParams();
 * address.line1 = '123 Main St';
 * address.city = 'Austin';
 * address.zip = '78701';
 * address.state = 'Texas';
 *
 * const errors = await validate(address);
 * // errors.length === 0
 * ```
 */
export class UnitedStatesAddressWithStateStringParams extends AbstractUnitedStatesAddressWithoutStateParams implements UnitedStatesAddress {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ADDRESS_STATE_MAX_LENGTH)
  state!: StateString;
}
