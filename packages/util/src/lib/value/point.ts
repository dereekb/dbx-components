import { type Factory } from '../getter/getter';
import { randomNumberFactory } from '../number';
import { boundNumberFunction, wrapNumberFunction } from '../number/bound';
import { cutValueToPrecisionFunction, type NumberPrecision, type RoundToPrecisionFunctionType } from '../number/round';
import { chainMapSameFunctions, mapIdentityFunction } from './map';
import { type Maybe } from './maybe.type';

// MARK: Lat/Lng Point
/**
 * Latitude value in degrees, ranging from -90 to 90.
 */
export type Latitude = number;

/**
 * Longitude value in degrees, ranging from -180 to 180.
 */
export type Longitude = number;

/**
 * Minimum valid latitude value (-90 degrees).
 */
export const MIN_LATITUDE_VALUE = -90.0;

/**
 * Maximum valid latitude value (90 degrees).
 */
export const MAX_LATITUDE_VALUE = 90.0;

/**
 * Total range of latitude values (180 degrees).
 */
export const TOTAL_LATITUDE_RANGE = MAX_LATITUDE_VALUE - MIN_LATITUDE_VALUE;

/**
 * Minimum valid longitude value (-180 degrees).
 */
export const MIN_LONGITUDE_VALUE = -180.0;

/**
 * Maximum valid longitude value (180 degrees).
 */
export const MAX_LONGITUDE_VALUE = 180.0;

/**
 * Total range of longitude values (360 degrees).
 */
export const TOTAL_LONGITUDE_RANGE = MAX_LONGITUDE_VALUE - MIN_LONGITUDE_VALUE;

/**
 * A geographic point represented by latitude and longitude.
 */
export interface LatLngPoint {
  lat: Latitude;
  lng: Longitude;
}

/**
 * A point decorated as LonLat.
 *
 * NOTE: This library (dbx-components) prefers the use of LatLngPoint over LonLatPoint. This is only provided as compatability for libraries (like Mapbox) that have LonLat-like points
 */
export interface LonLatPoint {
  lat: Latitude;
  lon: Longitude;
}

/**
 * Type guard that checks whether the input is a {@link LatLngPoint} by testing for `lat` and `lng` properties.
 */
export function isLatLngPoint(input: LatLngPoint | unknown): input is LatLngPoint {
  return typeof input === 'object' && (input as LatLngPoint).lat != null && (input as LatLngPoint).lng != null;
}

/**
 * Creates a shallow copy of the point so that mutations to the copy do not affect the original.
 *
 * @param input - point to copy
 * @returns a new point with the same coordinates
 */
export function copyLatLngPoint(input: LatLngPoint): LatLngPoint {
  return { lat: input.lat, lng: input.lng };
}

/**
 * Checks whether two points have identical coordinates. Handles `null`/`undefined` by returning `true` only if both are nullish.
 *
 * @param a - first point
 * @param b - second point
 * @returns `true` if both points have the same `lat` and `lng`, or both are nullish
 */
export function isSameLatLngPoint(a: Maybe<LatLngPoint>, b: Maybe<LatLngPoint>) {
  return a && b ? a.lat === b.lat && a.lng === b.lng : a == b;
}

/**
 * Computes the difference between two points (`a - b`), optionally wrapping the result to valid lat/lng ranges.
 *
 * @param a - the point to subtract from
 * @param b - the point to subtract
 * @param wrap - whether to wrap the result to valid lat/lng ranges; defaults to `true`
 * @returns a point representing the difference
 */
export function diffLatLngPoints(a: LatLngPoint, b: LatLngPoint, wrap = true) {
  const point = { lat: a.lat - b.lat, lng: a.lng - b.lng };
  return wrap ? wrapLatLngPoint(point) : point;
}

/**
 * Computes the sum of two points (`a + b`), optionally wrapping the result to valid lat/lng ranges.
 *
 * @param a - the first point
 * @param b - the second point
 * @param wrap - whether to wrap the result to valid lat/lng ranges; defaults to `true`
 * @returns a point representing the sum
 */
export function addLatLngPoints(a: LatLngPoint, b: LatLngPoint, wrap = true) {
  const point = { lat: a.lat + b.lat, lng: a.lng + b.lng };
  return wrap ? wrapLatLngPoint(point) : point;
}

/**
 * Wraps a point so its latitude is capped to [-90, 90] and its longitude wraps around [-180, 180].
 *
 * @param a - point to wrap
 * @returns a new point with valid coordinates
 */
export function wrapLatLngPoint(a: LatLngPoint): LatLngPoint {
  return { lat: capLatValue(a.lat), lng: wrapLngValue(a.lng) };
}

/**
 * Caps a latitude value to the valid range [-90, 90]. Values outside are clamped to the nearest boundary.
 */
export const capLatValue = boundNumberFunction<Latitude>({ min: MIN_LATITUDE_VALUE, max: MAX_LATITUDE_VALUE });

/**
 * Wraps a longitude value into the valid range [-180, 180]. Values that exceed the range wrap around to the opposite side.
 *
 * @example
 * ```ts
 * wrapLngValue(-190);
 * // 170
 *
 * wrapLngValue(190);
 * // -170
 * ```
 */
export const wrapLngValue = wrapNumberFunction<Longitude>({ min: MIN_LONGITUDE_VALUE, max: MAX_LONGITUDE_VALUE });

/**
 * Checks whether a latitude value is within the valid range [-90, 90].
 *
 * @param lat - latitude value to validate
 * @returns `true` if the value is a valid latitude
 */
export function isValidLatitude(lat: Latitude): boolean {
  return lat >= MIN_LATITUDE_VALUE && lat <= MAX_LATITUDE_VALUE;
}

/**
 * Checks whether a longitude value is within the valid range [-180, 180].
 *
 * @param lat - longitude value to validate
 * @returns `true` if the value is a valid longitude
 */
export function isValidLongitude(lat: Longitude): boolean {
  return lat >= MIN_LONGITUDE_VALUE && lat <= MAX_LONGITUDE_VALUE;
}

/**
 * Returns the default {@link LatLngPoint} at the origin (0, 0).
 *
 * @returns a point at latitude 0, longitude 0
 */
export function defaultLatLngPoint(): LatLngPoint {
  return { lat: 0, lng: 0 };
}

/**
 * Checks whether a point or string represents the default (0, 0) location.
 * Treats empty strings as the default.
 *
 * @param point - a point or lat/lng string to check
 * @returns `true` if the input represents the default location
 */
export function isDefaultLatLngPoint(point: LatLngPoint | LatLngString | '') {
  return typeof point === 'string' ? !point || point === DEFAULT_LAT_LNG_STRING_VALUE : isDefaultLatLngPointValue(point);
}

/**
 * Checks whether a point has coordinates of exactly (0, 0).
 *
 * @param point - point to check
 * @returns `true` if both `lat` and `lng` are 0
 */
export function isDefaultLatLngPointValue(point: LatLngPoint) {
  return point.lat === 0 && point.lng === 0;
}

/**
 * Returns the south-west-most possible point (-90, -180).
 *
 * @returns the minimum corner of the valid coordinate space
 */
export function swMostLatLngPoint(): LatLngPoint {
  return { lat: MIN_LATITUDE_VALUE, lng: MIN_LONGITUDE_VALUE };
}

/**
 * Returns the north-east-most possible point (90, 180).
 *
 * @returns the maximum corner of the valid coordinate space
 */
export function neMostLatLngPoint(): LatLngPoint {
  return { lat: MAX_LATITUDE_VALUE, lng: MAX_LONGITUDE_VALUE };
}

/**
 * Returns true if the input point's lat/lng values are within the acceptable values range.
 *
 * @param input - point to validate
 * @returns `true` if both lat and lng are within valid ranges
 */
export function isValidLatLngPoint(input: LatLngPoint): boolean {
  return isValidLatitude(input.lat) && isValidLongitude(input.lng);
}

/**
 * Latitude, Longitude tuple, representative.
 */
export type LatLngTuple = [Latitude, Longitude];

/**
 * Longitude, Latitude tuple. This is more analogous of x,y coordinates.
 */
export type LonLatTuple = [Longitude, Latitude];

/**
 * Converts the input to a {@link LatLngTuple} using the default configuration.
 *
 * @param lat - a latitude value or any lat/lng point input
 * @param lng - optional longitude when `lat` is a numeric latitude
 * @returns a `[lat, lng]` tuple
 */
export function latLngTuple(lat: LatLngPointInput, lng?: Longitude): LatLngTuple {
  return latLngTupleFunction()(lat, lng);
}

/**
 * Converts the input to a {@link LonLatTuple} (longitude-first ordering), useful for interop with libraries like Mapbox.
 *
 * @param lat - a latitude value or any lat/lng point input
 * @param lng - optional longitude when `lat` is a numeric latitude
 * @returns a `[lng, lat]` tuple
 *
 * @example
 * ```ts
 * const result: LonLatTuple = lonLatTuple([-120, 80]);
 * // result === [-120, 80]
 * ```
 */
export function lonLatTuple(lat: LatLngPointInput, lng?: Longitude): LonLatTuple {
  return latLngTupleFunction({ readLonLatTuples: true })(lat, lng).reverse() as LonLatTuple;
}

/**
 * Converts various lat/lng input formats into a {@link LatLngTuple}.
 */
export type LatLngTupleFunction = ((lat: LatLngPointInput, lng?: Longitude) => LatLngTuple) & ((latLng: string | LatLngTuple) => LatLngTuple) & ((latLng: LatLngPoint | LonLatPoint) => LatLngTuple) & ((lat: Latitude, lng?: Longitude) => LatLngTuple);

export type LatLngTupleFunctionConfig = LatLngPointFunctionConfig;

/**
 * Creates a {@link LatLngTupleFunction} that converts various input formats into `[lat, lng]` tuples,
 * applying optional precision configuration.
 *
 * @param config - optional configuration for precision and wrapping behavior
 * @returns a function that produces lat/lng tuples from flexible inputs
 */
export function latLngTupleFunction(config?: LatLngTupleFunctionConfig): LatLngTupleFunction {
  const fn = latLngPointFunction(config);
  return (lat: LatLngPointInput, lng?: Longitude) => {
    const latLng: LatLngPoint = fn(lat, lng);
    return [latLng.lat, latLng.lng];
  };
}

/**
 * A lat,lng encoded value as a comma-separated string.
 */
export type LatLngString = `${Latitude},${Longitude}`;

/**
 * Default LatLng value as a string.
 */
export const DEFAULT_LAT_LNG_STRING_VALUE = '0,0';

/**
 * Returns the default {@link LatLngString} value (`'0,0'`).
 *
 * @returns the default lat/lng string
 */
export function defaultLatLngString(): typeof DEFAULT_LAT_LNG_STRING_VALUE {
  return DEFAULT_LAT_LNG_STRING_VALUE;
}

/**
 * Union type of all accepted input formats for creating a {@link LatLngPoint}: a numeric latitude, a point object, a lat/lng string, or a tuple.
 */
export type LatLngPointInput = Latitude | LatLngPoint | LonLatPoint | LatLngString | LatLngTuple | string;

/**
 * Precision for lat/lng rounding, expressed as the number of decimal places.
 */
export type LatLngPrecision = NumberPrecision;

/**
 * Creates a {@link LatLngString} from the input using the default configuration.
 *
 * @param lat - latitude value or a point input
 * @param lng - optional longitude when `lat` is a numeric latitude
 * @returns a comma-separated lat/lng string
 */
export function latLngString(lat: Latitude, lng?: Longitude): LatLngString;
export function latLngString(latLng: LatLngPoint): LatLngString;
export function latLngString(latLng: LatLngString): LatLngString;
export function latLngString(lat: LatLngPointInput, lng?: Longitude): LatLngString {
  return latLngStringFunction()(lat, lng);
}

/**
 * Maximum number of decimal places supported by the lat/lng regex pattern.
 */
export const LAT_LNG_PATTERN_MAX_PRECISION = 15;

/**
 * A lat/lng regex with capture groups for lat and lng.
 *
 * https://stackoverflow.com/questions/3518504/regular-expression-for-matching-latitude-longitude-coordinates
 *
 * Has a max precision of 15 because Google Maps returns a 15 decimal places when copying a position.
 */
export const LAT_LNG_PATTERN = /(?<lat>^[-+]?(?:[1-8]?\d(?:\.\d{0,15})?|90(?:\.0{0,15})?))\s*,\s*(?<lng>[-+]?(?:180(?:\.0{0,15})?|(?:1[0-7]\d|[1-9]?\d)(?:\.\d{0,15})?))$/;

/**
 * Checks whether the input string matches the expected lat/lng pattern (e.g., `"30.5,-96.3"`).
 *
 * @param input - string to test
 * @returns `true` if the string is a valid lat/lng format
 */
export function isLatLngString(input: string): input is LatLngString {
  return LAT_LNG_PATTERN.test(input);
}

/**
 * 111KM meter precision, 0 decimal places
 */
export const LAT_LONG_100KM_PRECISION = 0;

/**
 * 11.1KM meter precision, 1 decimal place
 */
export const LAT_LONG_10KM_PRECISION = 1;

/**
 * 1.11KM meter precision, 2 decimal places
 */
export const LAT_LONG_1KM_PRECISION = 2;

/**
 * 111 meter precision, 3 decimal places
 */
export const LAT_LONG_100M_PRECISION = 3;

/**
 * 11.1 meter precision, 4 decimal places
 */
export const LAT_LONG_10M_PRECISION = 4;

/**
 * 001.11 meter precision, 5 decimal places
 */
export const LAT_LONG_1M_PRECISION = 5;

/**
 * 011.10 centimeter precision, 6 decimal places
 */
export const LAT_LONG_10CM_PRECISION = 6;

/**
 * 001.11 centimeter precision, 7 decimal places
 */
export const LAT_LONG_1CM_PRECISION = 7;

/**
 * 001.11 millimeter precision, 8 decimal places
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

/**
 * Creates a {@link LatLngPointPrecisionFunction} that rounds both lat and lng values
 * to the specified number of decimal places.
 *
 * @param precision - number of decimal places to retain
 * @param precisionRounding - optional rounding strategy (e.g., floor, ceil, round)
 * @returns a function that rounds points to the given precision
 */
export function latLngPointPrecisionFunction(precision: LatLngPrecision, precisionRounding?: RoundToPrecisionFunctionType): LatLngPointPrecisionFunction {
  const precisionFunction = cutValueToPrecisionFunction(precision, precisionRounding);
  return (latLng: LatLngPoint) => {
    const { lat: latInput, lng: lngInput } = latLng;
    const lat = precisionFunction(latInput);
    const lng = precisionFunction(lngInput);
    return { lat, lng };
  };
}

/**
 * Converts various lat/lng input formats into a {@link LatLngString}.
 */
export type LatLngStringFunction = ((lat: LatLngPointInput, lng?: Longitude) => LatLngString) & ((latLng: string | LatLngString) => LatLngString) & ((latLng: LatLngPoint | LonLatPoint) => LatLngString) & ((lat: Latitude, lng?: Longitude) => LatLngString);

export type LatLngStringFunctionConfig = LatLngPointFunctionConfig;

/**
 * Creates a {@link LatLngStringFunction} that converts various input formats into comma-separated lat/lng strings,
 * applying optional precision configuration.
 *
 * @param config - optional configuration for precision and wrapping behavior
 * @returns a function that produces lat/lng strings from flexible inputs
 */
export function latLngStringFunction(config?: LatLngStringFunctionConfig): LatLngStringFunction {
  const fn = latLngPointFunction(config);
  return (lat: LatLngPointInput, lng?: Longitude) => {
    const latLng: LatLngPoint = fn(lat, lng);
    return `${latLng.lat},${latLng.lng}`;
  };
}

/**
 * Converts various lat/lng input formats into a {@link LatLngPoint}.
 */
export type LatLngPointFunction = ((lat: LatLngPointInput, lng?: Longitude) => LatLngPoint) & ((latLng: string | LatLngString) => LatLngPoint) & ((latLng: LatLngPoint | LonLatPoint) => LatLngPoint) & ((lat: Latitude, lng: Longitude) => LatLngPoint);

/**
 * Configuration for creating a {@link LatLngPointFunction}.
 */
export interface LatLngPointFunctionConfig {
  /**
   * LatLngPrecision to use
   */
  precision?: LatLngPrecision | null;
  /**
   * Precision rounding to use.
   */
  precisionRounding?: RoundToPrecisionFunctionType;
  /**
   * Whether or not to wrap invalid LatLng values. If false, the values are validated and a default value is used instead.
   *
   * Is true by default.
   */
  wrap?: boolean;
  /**
   * Whether or not to valiate the input. Is ignored if wrap is not false.
   */
  validate?: boolean;
  /**
   * The default LatLngPoint to return if an invalid point is entered. Only used if validate is true.
   */
  default?: Factory<LatLngPoint>;
  /**
   * Treat tuples as LonLat instead of LatLng.
   *
   * False by default
   */
  readLonLatTuples?: boolean;
}

/**
 * Creates a {@link LatLngPoint} using the default configuration. Convenience wrapper around {@link latLngPointFunction}.
 *
 * @param lat - a latitude value or any lat/lng point input
 * @param lng - optional longitude when `lat` is a numeric latitude
 * @returns the parsed and normalized point
 *
 * @example
 * ```ts
 * const point = latLngPoint(30.59929, -96.38315);
 * // point.lat === 30.59929, point.lng === -96.38315
 * ```
 */
export function latLngPoint(lat: LatLngPointInput, lng?: Longitude): LatLngPoint {
  return latLngPointFunction()(lat, lng);
}

/**
 * Creates a {@link LatLngPointFunction} that normalizes various input formats (numbers, strings, tuples, objects)
 * into a {@link LatLngPoint}, with configurable precision, wrapping, and validation.
 *
 * @param config - optional configuration for precision, wrapping, validation, and tuple ordering
 * @returns a function that produces points from flexible inputs
 * @throws {Error} when the input cannot be parsed into a valid point
 *
 * @example
 * ```ts
 * const fn = latLngPointFunction({ precision: 3 });
 * const result = fn(30.59929, -96.38315);
 * // result.lat === 30.599, result.lng === -96.383
 * ```
 */
export function latLngPointFunction(config?: LatLngPointFunctionConfig): LatLngPointFunction {
  const { validate, wrap, default: defaultValue, precision = LAT_LONG_1MM_PRECISION, readLonLatTuples, precisionRounding } = config ?? {};
  const precisionFunction: LatLngPointPrecisionFunction = precision != null ? latLngPointPrecisionFunction(precision, precisionRounding) : mapIdentityFunction();
  const wrapFunction = wrap !== false ? wrapLatLngPoint : validate !== false ? validLatLngPointFunction(defaultValue) : undefined;
  const mapFn = chainMapSameFunctions([wrapFunction, precisionFunction]);
  return (lat: LatLngPointInput, lng?: Longitude) => {
    let latLng: LatLngPoint;

    const latType = typeof lat;

    if (latType === 'string') {
      latLng = latLngPointFromString(lat as string);
    } else if (Array.isArray(lat)) {
      if (readLonLatTuples) {
        const tuple = lat as LonLatTuple;
        latLng = { lat: tuple[1], lng: tuple[0] };
      } else {
        const tuple = lat as LatLngTuple;
        latLng = { lat: tuple[0], lng: tuple[1] };
      }
    } else if (latType === 'object') {
      latLng = { lat: (lat as LatLngPoint).lat, lng: (lat as LatLngPoint).lng ?? (lat as LonLatPoint).lon };
    } else if (lng != null) {
      latLng = { lat: lat as Latitude, lng };
    } else {
      throw new Error(`Invalid lat/lng input "${lat},${lng}"`);
    }

    return mapFn(latLng); // round to a given precision
  };
}

/**
 * Parses a comma-separated lat/lng string into a {@link LatLngPoint}. Invalid numeric values default to 0.
 *
 * @param latLngString - string in the format `"lat,lng"`
 * @returns the parsed point
 */
export function latLngPointFromString(latLngString: LatLngString | string): LatLngPoint {
  const [latString, lngString] = latLngString.split(',');
  const lat = Number(latString) || 0; // default lat and lng to 0 if not valid.
  const lng = Number(lngString) || 0;
  return { lat, lng };
}

/**
 * Validates a point and returns it if valid, or a default point otherwise.
 *
 * @param latLngPoint - point to validate
 * @param defaultValue - optional factory for the fallback point; defaults to `defaultLatLngPoint`
 * @returns the original point if valid, or the default
 */
export function validLatLngPoint(latLngPoint: LatLngPoint, defaultValue?: Factory<LatLngPoint>): LatLngPoint {
  return validLatLngPointFunction(defaultValue)(latLngPoint);
}

/**
 * Returns a valid LatLngPoint by validating the input and returns the input value if it is valid, or a default value that is valid.
 */
export type ValidLatLngPointFunction = (latLngPoint: LatLngPoint) => LatLngPoint;

/**
 * Creates a {@link ValidLatLngPointFunction} that returns the input point when valid, or a default point otherwise.
 *
 * @param defaultValue - factory for the fallback point; defaults to `defaultLatLngPoint`
 * @returns a validation function
 */
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
 * References a latLng using a LatLngTuple
 */
export type LatLngTupleRef = {
  readonly latLng: LatLngTuple;
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
export type LatLngRef = LatLngPointRef | LatLngStringRef | LatLngTupleRef;

/**
 * References a latLng using a LatLngPointInput.
 */
export type LatLngInputRef = {
  readonly latLng: LatLngPointInput;
};

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
 * Creates a {@link LatLngDataPointFunction} that wraps a {@link LatLngRef} object with its resolved point coordinates.
 *
 * @param config - optional configuration for precision and wrapping behavior
 * @returns a function that produces data points from lat/lng references
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

// MARK: Utility
/**
 * Configuration for {@link randomLatLngFactory}.
 */
export interface RandomLatLngFactoryConfig {
  /**
   * South-west corner of the bounding box for random generation. Partial values default to the minimum valid coordinates.
   */
  sw?: Partial<LatLngPoint>;
  /**
   * North-east corner of the bounding box for random generation. Partial values default to the maximum valid coordinates.
   */
  ne?: Partial<LatLngPoint>;
  /**
   * Precision of the LatLng to keep.
   */
  precision?: LatLngPrecision;
}

/**
 * A factory that produces random {@link LatLngPoint} values.
 */
export type RandomLatLngFactory = () => LatLngPoint;

/**
 * Creates a {@link RandomLatLngFactory} that generates random points within the specified bounding box.
 * The bounding box corners are capped/wrapped to valid coordinate ranges.
 *
 * @param config - optional bounding box and precision configuration
 * @returns a factory that produces random points within the bounds
 */
export function randomLatLngFactory(config?: RandomLatLngFactoryConfig): RandomLatLngFactory {
  const { sw, ne, precision } = { ...config, sw: { lat: MIN_LATITUDE_VALUE, lng: MIN_LONGITUDE_VALUE, ...config?.sw }, ne: { lat: MAX_LATITUDE_VALUE, lng: MAX_LONGITUDE_VALUE, ...config?.ne } };

  const randomLatFactory = randomNumberFactory({ min: capLatValue(sw.lat), max: capLatValue(ne.lat) }, 'none');
  const randomLngFactory = randomNumberFactory({ min: wrapLngValue(sw.lng), max: wrapLngValue(ne.lng) }, 'none');
  const precisionFunction = precision != null ? latLngPointPrecisionFunction(precision, 'round') : mapIdentityFunction<LatLngPoint>();

  return () => {
    return precisionFunction({ lat: randomLatFactory(), lng: randomLngFactory() });
  };
}

/**
 * Configuration for {@link randomLatLngFromCenterFactory}.
 */
export interface RandomLatLngFromCenterFactoryConfig extends Pick<RandomLatLngFactoryConfig, 'precision'> {
  /**
   * Center from which a rectangle is generated to pick random
   */
  center: LatLngPoint;
  /**
   * Max distance from the center.
   */
  latDistance: number;
  /**
   * Max lng distance from the center.
   */
  lngDistance: number;
}

/**
 * Creates a {@link RandomLatLngFactory} that generates random points within a rectangle
 * centered on the given point, extending by `latDistance` and `lngDistance` in each direction.
 *
 * @param config - center point, distances, and optional precision
 * @returns a factory that produces random points near the center
 */
export function randomLatLngFromCenterFactory(config: RandomLatLngFromCenterFactoryConfig): RandomLatLngFactory {
  const { center, latDistance, lngDistance, precision } = config;
  const sw = { lat: center.lat - latDistance, lng: center.lng - lngDistance };
  const ne = { lat: center.lat + latDistance, lng: center.lng + lngDistance };

  return randomLatLngFactory({
    sw,
    ne,
    precision
  });
}
