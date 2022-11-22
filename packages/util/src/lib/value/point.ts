import { Factory } from '../getter/getter';
import { randomNumberFactory } from '../number';
import { boundNumberFunction, wrapNumberFunction } from '../number/bound';
import { cutValueToPrecisionFunction, NumberPrecision } from '../number/round';
import { chainMapSameFunctions, mapIdentityFunction } from './map';

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
export const TOTAL_LATITUDE_RANGE = MAX_LATITUDE_VALUE - MIN_LATITUDE_VALUE;
export const MIN_LONGITUDE_VALUE = -180.0;
export const MAX_LONGITUDE_VALUE = 180.0;
export const TOTAL_LONGITUDE_RANGE = MAX_LONGITUDE_VALUE - MIN_LONGITUDE_VALUE;

export interface LatLngPoint {
  lat: Latitude;
  lng: Longitude;
}

/**
 * A point decorated as LonLat.
 *
 * NOTE: This library prefers the use of LatLngPoint over LonLatPoint. This is only provided as compatability for libraries (like Mapbox) that have LonLat-like points
 */
export interface LonLatPoint {
  lat: Latitude;
  lon: Longitude;
}

export function isLatLngPoint(input: LatLngPoint | unknown): input is LatLngPoint {
  return typeof input === 'object' && (input as LatLngPoint).lat != null && (input as LatLngPoint).lng != null;
}

export function isSameLatLngPoint(a: LatLngPoint, b: LatLngPoint) {
  return a.lat === b.lat && a.lng === b.lng;
}

export function diffLatLngPoints(a: LatLngPoint, b: LatLngPoint, wrap = true) {
  const point = { lat: a.lat - b.lat, lng: a.lng - b.lng };
  return wrap ? wrapLatLngPoint(point) : point;
}

export function addLatLngPoints(a: LatLngPoint, b: LatLngPoint, wrap = true) {
  const point = { lat: a.lat + b.lat, lng: a.lng + b.lng };
  return wrap ? wrapLatLngPoint(point) : point;
}

export function wrapLatLngPoint(a: LatLngPoint): LatLngPoint {
  return { lat: capLatValue(a.lat), lng: wrapLngValue(a.lng) };
}

export const capLatValue = boundNumberFunction<Latitude>({ min: MIN_LATITUDE_VALUE, max: MAX_LATITUDE_VALUE });
export const wrapLngValue = wrapNumberFunction<Longitude>({ min: MIN_LONGITUDE_VALUE, max: MAX_LONGITUDE_VALUE });

export function isValidLatitude(lat: Latitude): boolean {
  return lat >= MIN_LATITUDE_VALUE && lat <= MAX_LATITUDE_VALUE;
}

export function isValidLongitude(lat: Longitude): boolean {
  return lat >= MIN_LONGITUDE_VALUE && lat <= MAX_LONGITUDE_VALUE;
}

export function defaultLatLngPoint(): LatLngPoint {
  return { lat: 0, lng: 0 };
}

export function isDefaultLatLngPoint(point: LatLngPoint): boolean {
  return point.lat === 0 && point.lng === 0;
}

export function swMostLatLngPoint(): LatLngPoint {
  return { lat: MIN_LATITUDE_VALUE, lng: MIN_LONGITUDE_VALUE };
}

export function neMostLatLngPoint(): LatLngPoint {
  return { lat: MAX_LATITUDE_VALUE, lng: MAX_LONGITUDE_VALUE };
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
 * Latitude, Longitude tuple, representative.
 */
export type LatLngTuple = [Latitude, Longitude];

/**
 * Longitude, Latitude tuple. This is more analogous of x,y coordinates.
 */
export type LonLatTuple = [Longitude, Latitude];

/**
 * Converts the input to a LatLngTuple.
 *
 * @param lat
 * @param lng
 * @returns
 */
export function latLngTuple(lat: LatLngPointInput, lng?: Longitude): LatLngTuple {
  return latLngTupleFunction()(lat, lng);
}

/**
 * Converts the input to a LonLatTuple.
 *
 * @param lat
 * @param lng
 * @returns
 */
export function lonLatTuple(lat: LatLngPointInput, lng?: Longitude): LonLatTuple {
  return latLngTupleFunction({ readLonLatTuples: true })(lat, lng).reverse() as LonLatTuple;
}

/**
 * Converts the input to a LatLngString
 */
export type LatLngTupleFunction = ((lat: LatLngPointInput, lng?: Longitude) => LatLngTuple) & ((latLng: string | LatLngTuple) => LatLngTuple) & ((latLng: LatLngPoint | LonLatPoint) => LatLngTuple) & ((lat: Latitude, lng?: Longitude) => LatLngTuple);

export type LatLngTupleFunctionConfig = LatLngPointFunctionConfig;

/**
 * Creates a LatLngTupleFunction
 *
 * @param precision
 * @returns
 */
export function latLngTupleFunction(config?: LatLngTupleFunctionConfig): LatLngTupleFunction {
  const fn = latLngPointFunction(config);
  return (lat: LatLngPointInput, lng?: Longitude) => {
    const latLng: LatLngPoint = fn(lat, lng);
    return [latLng.lat, latLng.lng];
  };
}

/**
 * A lat,lng encoded value.
 */
export type LatLngString = `${Latitude},${Longitude}`;

/**
 * Default LatLng value as a string.
 */
export const DEFAULT_LAT_LNG_STRING_VALUE = '0,0';

export type LatLngPointInput = Latitude | LatLngPoint | LonLatPoint | LatLngString | LatLngTuple | string;

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
export function latLngString(lat: LatLngPointInput, lng?: Longitude): LatLngString {
  return latLngStringFunction()(lat, lng);
}

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
 * Creates a LatLngPointPrecisionFunction
 * @param precision
 * @returns
 */
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
export type LatLngStringFunction = ((lat: LatLngPointInput, lng?: Longitude) => LatLngString) & ((latLng: string | LatLngString) => LatLngString) & ((latLng: LatLngPoint | LonLatPoint) => LatLngString) & ((lat: Latitude, lng?: Longitude) => LatLngString);

export type LatLngStringFunctionConfig = LatLngPointFunctionConfig;

/**
 * Creates a LatLngStringFunction
 *
 * @param precision
 * @returns
 */
export function latLngStringFunction(config?: LatLngStringFunctionConfig): LatLngStringFunction {
  const fn = latLngPointFunction(config);
  return (lat: LatLngPointInput, lng?: Longitude) => {
    const latLng: LatLngPoint = fn(lat, lng);
    return `${latLng.lat},${latLng.lng}`;
  };
}

/**
 * Converts the input to a LatLngPoint
 */
export type LatLngPointFunction = ((lat: LatLngPointInput, lng?: Longitude) => LatLngPoint) & ((latLng: string | LatLngString) => LatLngPoint) & ((latLng: LatLngPoint | LonLatPoint) => LatLngPoint) & ((lat: Latitude, lng: Longitude) => LatLngPoint);

export interface LatLngPointFunctionConfig {
  /**
   * LatLngPrecision to use
   */
  precision?: LatLngPrecision | null;
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
 * Creates a LatLngPoint. Uses latLngPointFunction() internally.
 *
 * @param lat
 * @param lng
 * @returns
 */
export function latLngPoint(lat: LatLngPointInput, lng?: Longitude): LatLngPoint {
  return latLngPointFunction()(lat, lng);
}

/**
 * Creates a LatLngPointFunction
 *
 * @param precision
 * @returns
 */
export function latLngPointFunction(config?: LatLngPointFunctionConfig): LatLngPointFunction {
  const { validate, wrap, default: defaultValue, precision = LAT_LONG_1MM_PRECISION, readLonLatTuples } = config ?? {};
  const precisionFunction: LatLngPointPrecisionFunction = precision != null ? latLngPointPrecisionFunction(precision) : mapIdentityFunction();
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

// MARK: Utility
export interface RandomLatLngFactoryConfig {
  sw?: Partial<LatLngPoint>;
  ne?: Partial<LatLngPoint>;
}

export function randomLatLngFactory(config?: RandomLatLngFactoryConfig): () => LatLngPoint {
  const { sw, ne } = { ...config, sw: { lat: MIN_LATITUDE_VALUE, lng: MIN_LONGITUDE_VALUE, ...config?.sw }, ne: { lat: MAX_LATITUDE_VALUE, lng: MAX_LONGITUDE_VALUE, ...config?.ne } };

  const randomLatFactory = randomNumberFactory({ min: sw.lat, max: ne.lat });
  const randomLngFactory = randomNumberFactory({ min: sw.lng, max: ne.lng });

  return () => {
    return { lat: randomLatFactory(), lng: randomLngFactory() };
  };
}

// MARK: Compat
/**
 * @deprecated use LatLngPointInput
 */
export type LatLngInput = LatLngPointInput;
