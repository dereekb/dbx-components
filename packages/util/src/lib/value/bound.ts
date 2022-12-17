import { asArray, Maybe } from '@dereekb/util';
import { Rectangle, rectangleOverlapsRectangle, Vector } from './vector';
import { Writable } from 'ts-essentials';
import { latLngPointFunction, LatLngPoint, LatLngPointInput, LatLngPrecision, LatLngPointFunction, isLatLngPoint, isSameLatLngPoint, diffLatLngPoints, TOTAL_LONGITUDE_RANGE, copyLatLngPoint } from './point';
import { DecisionFunction } from './decision';
import { ArrayOrValue, firstValue } from '../array';

export type LatLngBoundSouthWestPoint = LatLngPoint;
export type LatLngBoundNothEastPoint = LatLngPoint;

export interface LatLngBound {
  sw: LatLngBoundSouthWestPoint;
  ne: LatLngBoundNothEastPoint;
}

export type LatLngBoundOrPoint = LatLngBound | LatLngPoint;

export function isLatLngBound(input: LatLngBound | unknown): input is LatLngBound {
  return typeof input === 'object' && (input as LatLngBound).sw != null && (input as LatLngBound).ne != null;
}

export function copyLatLngBound(input: LatLngBound): LatLngBound {
  return { sw: copyLatLngPoint(input.sw), ne: copyLatLngPoint(input.ne) };
}

export function isSameLatLngBound(a: LatLngBound, b: LatLngBound): boolean {
  return isSameLatLngPoint(a.sw, b.sw) && isSameLatLngPoint(a.ne, b.ne);
}

export function diffLatLngBoundPoints(bounds: LatLngBound, wrap = false): LatLngPoint {
  return diffLatLngPoints(bounds.ne, bounds.sw, wrap);
}

/**
 * Returns true if the input LatLngBound either strictly wraps the map or fully wraps the map.
 *
 * @param bound
 * @returns
 */
export function latLngBoundWrapsMap(bound: LatLngBound) {
  return latLngBoundStrictlyWrapsMap(bound) || latLngBoundFullyWrapsMap(bound);
}

/**
 * Returns true if the input LatLngBound's sw corner comes after the ne corner.
 *
 * @param bound
 * @returns
 */
export function latLngBoundStrictlyWrapsMap(bound: LatLngBound) {
  return bound.sw.lng > bound.ne.lng;
}

/**
 * Returns true if the LatLngBound's sw and ne longitudes's total distance is greater than the
 * @param bound
 * @returns
 */
export function latLngBoundFullyWrapsMap(bound: LatLngBound) {
  return Math.abs(bound.ne.lng - bound.sw.lng) > TOTAL_LONGITUDE_RANGE;
}

export function latLngBoundNorthEastPoint(bound: LatLngBound): LatLngPoint {
  return bound.ne;
}

export function latLngBoundNorthWestPoint(bound: LatLngBound): LatLngPoint {
  return { lat: bound.ne.lat, lng: bound.sw.lng };
}

export function latLngBoundSouthEastPoint(bound: LatLngBound): LatLngPoint {
  return { lat: bound.sw.lat, lng: bound.ne.lng };
}

export function latLngBoundSouthWestPoint(bound: LatLngBound): LatLngPoint {
  return bound.sw;
}

export function latLngBoundCenterPoint(bound: LatLngBound): LatLngPoint {
  const { sw, ne } = bound;
  const lat = (sw.lat + ne.lat) / 2;
  const lng = (sw.lng + ne.lng) / 2;
  return { lat, lng };
}

export function latLngBoundNorthBound(bound: LatLngBound): number {
  return bound.ne.lat;
}

export function latLngBoundSouthBound(bound: LatLngBound): number {
  return bound.sw.lat;
}

export function latLngBoundEastBound(bound: LatLngBound): number {
  return bound.ne.lng;
}

export function latLngBoundWestBound(bound: LatLngBound): number {
  return bound.sw.lng;
}

/**
 * Tuple of the sw corner and the north east point.
 */
export type LatLngBoundTuple = [LatLngBoundSouthWestPoint | LatLngPointInput, LatLngBoundNothEastPoint | LatLngPointInput];
export type LatLngBoundTuplePoints = [LatLngPointInput, LatLngPointInput, LatLngPointInput, LatLngPointInput];
export type LatLngBoundInput = LatLngBound | LatLngBoundTuple | LatLngBoundTuplePoints;

// MARK: BoundTuple
export function latLngBoundTuple(input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint): LatLngBoundTuple {
  return latLngBoundTupleFunction()(input, inputNe);
}

/**
 * Converts the input to a LatLngString
 */
export type LatLngBoundTupleFunction = ((input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint) => LatLngBoundTuple) & ((sw: LatLngBoundSouthWestPoint, ne: LatLngBoundNothEastPoint) => LatLngBoundTuple) & ((bound: LatLngBoundInput) => LatLngBoundTuple);

export type LatLngBoundTupleFunctionConfig = LatLngBoundFunctionConfig;

/**
 * Creates a LatLngBoundTupleFunction
 *
 * @param precision
 * @returns
 */
export function latLngBoundTupleFunction(config?: LatLngBoundTupleFunctionConfig): LatLngBoundTupleFunction {
  const fn = latLngBoundFunction(config);
  return (input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint) => {
    const latLngBound: LatLngBound = fn(input, inputNe);
    return [latLngBound.sw, latLngBound.ne];
  };
}

// MARK: Bound
export function latLngBound(input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint): LatLngBound {
  return latLngBoundFunction()(input, inputNe);
}

/**
 * Converts the input to a LatLngBound
 */
export type LatLngBoundFunction = ((input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint) => LatLngBound) & ((sw: LatLngBoundSouthWestPoint, ne: LatLngBoundNothEastPoint) => LatLngBound) & ((bound: LatLngBoundInput) => LatLngBound);

export interface LatLngBoundFunctionConfig {
  /**
   * Point function to use for calculations.
   */
  pointFunction?: LatLngPointFunction;
  /**
   * LatLngPrecision to use if pointFunction is not provided.
   */
  precision?: LatLngPrecision;
}

export function latLngBoundFunction(config?: LatLngBoundFunctionConfig): LatLngBoundFunction {
  const { pointFunction, precision } = config ?? {};
  const latLngPoint = pointFunction ?? latLngPointFunction({ precision });
  return (input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint) => {
    let bound: LatLngBound | undefined;

    if (Array.isArray(input)) {
      if (input.length === 2) {
        const [sw, ne] = input as LatLngBoundTuple;
        bound = {
          sw: latLngPoint(sw),
          ne: latLngPoint(ne)
        };
      } else if (input.length === 4) {
        const points = input.map(latLngPoint);
        const lats = points.map((x) => x.lat);
        const lngs = points.map((x) => x.lng);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        bound = {
          sw: latLngPoint([minLat, minLng]),
          ne: latLngPoint([maxLat, maxLng])
        };
      }
    } else if (input && inputNe) {
      bound = { sw: input as LatLngBoundSouthWestPoint, ne: inputNe };
    } else if ((input as LatLngBound).sw && (input as LatLngBound).ne) {
      bound = input as LatLngBound;
    }

    if (!bound) {
      throw new Error(`Invalid latLngBound input "${input}" + "${inputNe}"`);
    }

    return bound;
  };
}

export type ExtendLatLngBoundInput = ArrayOrValue<LatLngBoundOrPoint>;

export function latLngBoundFromInput(input: ExtendLatLngBoundInput): Maybe<LatLngBound> {
  let bound: Maybe<LatLngBound>;

  const first = firstValue(input);

  if (first != null) {
    if (isLatLngBound(first)) {
      bound = first;
    } else {
      bound = {
        sw: first,
        ne: first
      };
    }

    if (Array.isArray(input)) {
      bound = extendLatLngBound(bound, input);
    }
  }

  return bound;
}

export function extendLatLngBound(bound: LatLngBound, extendWith: ExtendLatLngBoundInput): LatLngBound {
  let { sw, ne } = copyLatLngBound(bound);

  asArray(extendWith).forEach((x) => {
    let xsw: LatLngPoint;
    let xne: LatLngPoint;

    if (isLatLngBound(x)) {
      xsw = x.sw;
      xne = x.ne;
    } else {
      xsw = x;
      xne = x;
    }

    sw.lng = Math.min(xsw.lng, sw.lng);
    sw.lat = Math.min(xsw.lat, sw.lat);
    ne.lng = Math.max(xne.lng, ne.lng);
    ne.lat = Math.max(xne.lat, ne.lat);
  });

  return {
    sw,
    ne
  };
}

export type LatLngBoundCheckFunction = DecisionFunction<LatLngBoundOrPoint>;

/**
 * Function that returns true if the input is entirely within the context's bound.
 */
export type IsWithinLatLngBoundFunction = LatLngBoundCheckFunction & { readonly _bound: LatLngBound };

export function isWithinLatLngBoundFunction(bound: LatLngBound): IsWithinLatLngBoundFunction {
  const fn = ((boundOrPoint: LatLngBoundOrPoint) => {
    if (isLatLngPoint(boundOrPoint)) {
      return isLatLngPointWithinLatLngBound(boundOrPoint, bound);
    } else {
      return isLatLngBoundWithinLatLngBound(boundOrPoint, bound);
    }
  }) as unknown as Writable<IsWithinLatLngBoundFunction>;

  (fn as unknown as Writable<IsWithinLatLngBoundFunction>)._bound = bound;

  return fn as IsWithinLatLngBoundFunction;
}

export function isLatLngBoundWithinLatLngBound(bound: LatLngBound, within: LatLngBound): boolean {
  return isLatLngPointWithinLatLngBound(bound.sw, within) && isLatLngPointWithinLatLngBound(bound.ne, within);
}

export function isLatLngPointWithinLatLngBound(point: LatLngPoint, within: LatLngBound): boolean {
  const { sw, ne } = within;
  const { lat, lng } = point;

  const latIsBounded = lat >= sw.lat && lat <= ne.lat;

  if (latIsBounded) {
    if (latLngBoundStrictlyWrapsMap(within)) {
      // included if between sw to the max possible value/bound (180), and ne to the min possible value/bound (-180)
      return lng >= sw.lng || lng <= ne.lng;
    } else {
      return lng >= sw.lng && lng <= ne.lng;
    }
  }

  return false;
}

/**
 * Function that returns true if the input overlaps the context's bound.
 */
export type OverlapsLatLngBoundFunction = LatLngBoundCheckFunction & { readonly _bound: LatLngBound };

export function latLngBoundOverlapsLatLngBound(a: LatLngBound, b: LatLngBound): boolean {
  return overlapsLatLngBoundFunction(a)(b);
}

export function overlapsLatLngBoundFunction(bound: LatLngBound): OverlapsLatLngBoundFunction {
  const a: Rectangle = boundToRectangle(bound);

  const fn = ((boundOrPoint: LatLngBoundOrPoint) => {
    if (isLatLngPoint(boundOrPoint)) {
      return isLatLngPointWithinLatLngBound(boundOrPoint, bound);
    } else {
      return rectangleOverlapsRectangle(a, boundToRectangle(boundOrPoint));
    }
  }) as unknown as Writable<IsWithinLatLngBoundFunction>;

  (fn as unknown as Writable<IsWithinLatLngBoundFunction>)._bound = bound;

  return fn as IsWithinLatLngBoundFunction;
}

export const TOTAL_SPAN_OF_LONGITUDE = 360;

/**
 * "normalizes" the space so that the left -180 longitudinal bound will begin at 360.
 *
 * This turns the latitude/longitude into two rectangles in an arbitrary space that can be safely compared without worrying about wrapping.
 *
 * @param bound
 */
export function boundToRectangle(bound: LatLngBound): Rectangle {
  function pointToVector(point: LatLngPoint, lngOffset: number = 0): Vector {
    return { x: point.lng + TOTAL_SPAN_OF_LONGITUDE + lngOffset, y: point.lat };
  }

  let tr: Vector;
  let bl: Vector;

  if (latLngBoundWrapsMap(bound)) {
    // compute the NE/TR corner first
    tr = pointToVector(bound.ne);

    const swDistanceToBound = bound.sw.lng - 180;
    const neDistanceToBound = bound.ne.lng + 180;
    const totalOffset = neDistanceToBound - swDistanceToBound;

    bl = { x: tr.x - totalOffset, y: bound.sw.lat };
  } else {
    tr = pointToVector(bound.ne);
    bl = pointToVector(bound.sw);
  }

  return { bl, tr };
}
