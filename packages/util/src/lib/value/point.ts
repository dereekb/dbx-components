import { Factory } from '../getter/getter';
import { cutValueToPrecisionFunction, NumberPrecision } from '../number/round';

// MARK: Lat/Lng Point
/**
 * Latitude value
 */
export type Latitude = number;

/**
 * Longitude value
 */
export type Longitude = number;

export const MIN_LATITUDE_VALUE = -90.0;
export const MAX_LATITUDE_VALUE = 90.0;
export const MIN_LONGITUDE_VALUE = -180.0;
export const MAX_LONGITUDE_VALUE = 180.0;

export interface LatLngPoint {
  lat: Latitude;
  lng: Longitude;
}

export function latLngPoint(lat: Latitude, lng: Longitude): LatLngPoint {
  return { lat, lng };
}

export function isValidLatitude(lat: Latitude): boolean {
  return lat >= MIN_LATITUDE_VALUE && lat <= MAX_LATITUDE_VALUE;
}

export function isValidLongitude(lat: Longitude): boolean {
  return lat >= MIN_LONGITUDE_VALUE && lat <= MAX_LONGITUDE_VALUE;
}

export function defaultLatLngPoint(): LatLngPoint {
  return { lat: 0, lng: 0 };
}

/**
 * Returns true if the input point's lat/lng values are within the acceptable values range.
 *
 * @param input
 * @returns
 */
export function isValidLatLngPoint(input: LatLngPoint): boolean {
  return isValidLatitude(input.lat) && isValidLongitude(input.lng);
}

/**
 * A lat,lng encoded value.
 */
export type LatLngString = `${Latitude},${Longitude}`;

export type LatLngPrecision = NumberPrecision;

/**
 * Creates a LatLngString from the input.
 *
 * @param lat
 * @param lng
 */
export function latLngString(lat: Latitude, lng?: Longitude): LatLngString;
export function latLngString(latLng: LatLngPoint): LatLngString;
export function latLngString(latLng: LatLngString): LatLngString;
export function latLngString(lat: Latitude | LatLngPoint | LatLngString, lng?: Longitude): LatLngString {
  return latLngStringFunction()(lat, lng);
}

/**
 * A lat/lng regex with capture groups for lat and lng.
 *
 * Has a max precision of 10, which is easily precise enough for all GPS cases.
 *
 * https://stackoverflow.com/questions/3518504/regular-expression-for-matching-latitude-longitude-coordinates
 */
export const LAT_LNG_PATTERN = /(?<lat>^[-+]?(?:[1-8]?\d(?:\.\d{0,10})?|90(?:\.0{0,10})?))\s*,\s*(?<lng>[-+]?(?:180(?:\.0{0,10})?|(?:1[0-7]\d|[1-9]?\d)(?:\.\d{0,10})?))$/;

/**
 * Checks whether or not the input has the expected pattern.
 *
 * @param input
 */
export function isLatLngString(input: string): input is LatLngString {
  return LAT_LNG_PATTERN.test(input);
}

/**
 * 111KM meter preicison, 0 decimal places
 */
export const LAT_LONG_100KM_PRECISION = 0;

/**
 * 11.1KM meter preicison, 1 decimal place
 */
export const LAT_LONG_10KM_PRECISION = 1;

/**
 * 1.11KM meter preicison, 2 decimal places
 */
export const LAT_LONG_1KM_PRECISION = 2;

/**
 * 111 meter preicison, 3 decimal places
 */
export const LAT_LONG_100M_PRECISION = 3;

/**
 * 11.1 meter preicison, 4 decimal places
 */
export const LAT_LONG_10M_PRECISION = 4;

/**
 * 001.11 meter preicison, 5 decimal places
 */
export const LAT_LONG_1M_PRECISION = 5;

/**
 * 011.10 centimeter preicison, 6 decimal places
 */
export const LAT_LONG_10CM_PRECISION = 6;

/**
 * 001.11 centimeter precision, 7 decimal places
 */
export const LAT_LONG_1CM_PRECISION = 7;

/**
 * 001.11 milimeter precision, 8 decimal places
 */
export const LAT_LONG_1MM_PRECISION = 8;

/**
 * 0.1mm precision, 9 decimal places
 *
 * "Hey, check out this specific sand grain!"
 *
 * https://xkcd.com/2170/
 */
export const LAT_LONG_GRAINS_OF_SAND_PRECISION = 9;

/**
 * Rounds the input latLng value to a given precision.
 */
export type LatLngPointPrecisionFunction = (latLngPoint: LatLngPoint) => LatLngPoint;

export function latLngPointPrecisionFunction(precision: LatLngPrecision): LatLngPointPrecisionFunction {
  const precisionFunction = cutValueToPrecisionFunction(precision);
  return (latLng: LatLngPoint) => {
    const { lat: latInput, lng: lngInput } = latLng;
    const lat = precisionFunction(latInput);
    const lng = precisionFunction(lngInput);
    return { lat, lng };
  };
}

/**
 * Converts the input to a LatLngString
 */
export type LatLngStringFunction = ((lat: Latitude | LatLngPoint | LatLngString | string, lng?: Longitude) => LatLngString) & ((latLng: string | LatLngString) => LatLngString) & ((latLng: LatLngPoint) => LatLngString) & ((lat: Latitude, lng?: Longitude) => LatLngString);

export type LatLngStringFunctionConfig = LatLngPointFunctionConfig;

/**
 * Creates a LatLngStringFunction
 *
 * @param precision
 * @returns
 */
export function latLngStringFunction(config?: LatLngStringFunctionConfig): LatLngStringFunction {
  const fn = latLngPointFunction(config);
  return (lat: Latitude | LatLngPoint | LatLngString | string, lng?: Longitude) => {
    const latLng: LatLngPoint = fn(lat, lng);
    return `${latLng.lat},${latLng.lng}`;
  };
}

/**
 * Converts the input to a LatLngPoint
 */
export type LatLngPointFunction = ((lat: Latitude | LatLngPoint | LatLngString | string, lng?: Longitude) => LatLngPoint) & ((latLng: string | LatLngString) => LatLngPoint) & ((latLng: LatLngPoint) => LatLngPoint) & ((lat: Latitude, lng?: Longitude) => LatLngPoint);

export interface LatLngPointFunctionConfig {
  /**
   * LatLngPrecision to use
   */
  precision?: LatLngPrecision;
  /**
   * Whether or not to validate and only return valid LatLng values.
   *
   * Is true by default.
   */
  validate?: boolean;
  /**
   * The default LatLngPoint to return.
   */
  default?: Factory<LatLngPoint>;
}

/**
 * Creates a LatLngPointFunction
 *
 * @param precision
 * @returns
 */
export function latLngPointFunction(config?: LatLngPointFunctionConfig): LatLngPointFunction {
  const { validate, default: defaultValue, precision = LAT_LONG_1MM_PRECISION } = config ?? {};
  const precisionFunction = latLngPointPrecisionFunction(precision);
  const validateFunction = validLatLngPointFunction(defaultValue);
  const mapFn = validate !== false ? (input: LatLngPoint) => precisionFunction(validateFunction(input)) : precisionFunction;
  return (lat: Latitude | LatLngPoint | LatLngString | string, lng?: Longitude) => {
    let latLng: LatLngPoint;

    const latType = typeof lat;

    if (latType === 'string') {
      latLng = latLngPointFromString(lat as string);
    } else if (latType === 'object') {
      latLng = lat as LatLngPoint;
    } else if (lng != null) {
      latLng = latLngPoint(lat as Latitude, lng);
    } else {
      throw new Error(`Invalid lat/lng input "${lat},${lng}"`);
    }

    return mapFn(latLng); // round to a given precision
  };
}

/**
 * Creates a LatLngPoint from the input latLng string.
 *
 * @param latLngString
 */
export function latLngPointFromString(latLngString: LatLngString | string): LatLngPoint {
  const [latString, lngString] = latLngString.split(',');
  const lat = Number(latString) || 0; // default lat and lng to 0 if not valid.
  const lng = Number(lngString) || 0;
  return { lat, lng };
}

export function validLatLngPoint(latLngPoint: LatLngPoint, defaultValue?: Factory<LatLngPoint>): LatLngPoint {
  return validLatLngPointFunction(defaultValue)(latLngPoint);
}

/**
 * Returns a valid LatLngPoint by validating the input and returns the input value if it is valid, or a default value that is valid.
 *
 * @param latLngPoint
 */
export type ValidLatLngPointFunction = (latLngPoint: LatLngPoint) => LatLngPoint;

export function validLatLngPointFunction(defaultValue: Factory<LatLngPoint> = defaultLatLngPoint): ValidLatLngPointFunction {
  return (latLngPoint: LatLngPoint) => (isValidLatLngPoint(latLngPoint) ? latLngPoint : defaultValue());
}

// MARK: Reference
/**
 * References a latLng using a LatLngPoint
 */
export type LatLngPointRef = {
  readonly latLng: LatLngPoint;
};

/**
 * References a latLng using a LatLngString
 */
export type LatLngStringRef = {
  readonly latLng: LatLngString;
};

/**
 * An object that references a latLng
 */
export type LatLngRef = LatLngPointRef | LatLngStringRef;

/**
 * A LatLngPointRef with arbitrary data
 */
export type LatLngDataPoint<T> = LatLngPointRef & {
  readonly data: T;
};

/**
 * Converts the input value to a LatLngDataPoint
 */
export type LatLngDataPointFunction<T extends LatLngRef> = (data: T) => LatLngDataPoint<T>;

/**
 * Creates a LatLngDataPointFunction
 *
 * @param precision
 * @returns
 */
export function latLngDataPointFunction<T extends LatLngRef>(config?: LatLngPointFunctionConfig): LatLngDataPointFunction<T> {
  const fn = latLngPointFunction(config);
  return (data: T) => {
    const latLng: LatLngPoint = fn(data.latLng);
    return {
      latLng,
      data
    };
  };
}
