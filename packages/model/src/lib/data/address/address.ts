import { AddressLineString, CityString, StateString, StateCodeString, ZipCodeString, UnitedStatesAddress, US_STATE_CODE_STRING_REGEX, ZIP_CODE_STRING_REGEX } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const ADDRESS_LINE_MAX_LENGTH = 50;

export const ADDRESS_CITY_MAX_LENGTH = 80;
export const ADDRESS_STATE_MAX_LENGTH = 30;
export const ADDRESS_STATE_CODE_MAX_LENGTH = 2;

export const ADDRESS_ZIP_MAX_LENGTH = 11;
export const ADDRESS_COUNTRY_MAX_LENGTH = 80;

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
 * UnitedStatesAddress that enforces a StateCode for the state value.
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
 * UnitedStatesAddress that enforces a State for the state value.
 */
export class UnitedStatesAddressWithStateStringParams extends AbstractUnitedStatesAddressWithoutStateParams implements UnitedStatesAddress {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ADDRESS_STATE_MAX_LENGTH)
  state!: StateString;
}
