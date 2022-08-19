import { Rectangle, rectangleOverlapsRectangle, Vector } from './vector';
import { Writable } from 'ts-essentials';
import { latLngPointFunction, LatLngPoint, LatLngInput, LatLngPrecision, LatLngPointFunction, isLatLngPoint, isSameLatLngPoint } from './point';

export type LatLngBoundSouthWestPoint = LatLngPoint;
export type LatLngBoundNothEastPoint = LatLngPoint;

export interface LatLngBound {
  sw: LatLngBoundSouthWestPoint;
  ne: LatLngBoundNothEastPoint;
}

export function isLatLngBound(input: LatLngBound | unknown): input is LatLngBound {
  return typeof input === 'object' && (input as LatLngBound).sw !== null && (input as LatLngBound).ne !== null;
}

export function isSameLatLngBound(a: LatLngBound, b: LatLngBound): boolean {
  return isSameLatLngPoint(a.sw, b.sw) && isSameLatLngPoint(a.ne, b.ne);
}

/**
 * Returns true if the input LatLngBound wrap across the wrapped longitudinal edge of a map.
 *
 * @param bound
 * @returns
 */
export function latLngBoundWrapsMap(bound: LatLngBound) {
  return bound.sw.lng > bound.ne.lng;
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
  const lat = (sw.lng + ne.lng) / 2;
  const lng = (sw.lat + ne.lat) / 2;
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
export type LatLngBoundTuple = [LatLngBoundSouthWestPoint | LatLngInput, LatLngBoundNothEastPoint | LatLngInput];
export type LatLngBoundTuplePoints = [LatLngInput, LatLngInput, LatLngInput, LatLngInput];
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

/**
 * Function that returns true if the input is entirely within the context's bound.
 */
export type IsWithinLatLngBoundFunction = ((boundOrPoint: LatLngBound | LatLngPoint) => boolean) & { readonly _bound: LatLngBound };

export function isWithinLatLngBoundFunction(bound: LatLngBound): IsWithinLatLngBoundFunction {
  const fn = ((boundOrPoint: LatLngBound | LatLngPoint) => {
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

  const latIsBounded = sw.lat <= point.lat && ne.lat <= point.lat;

  if (latIsBounded) {
    if (latLngBoundWrapsMap(within)) {
      // test for map wrapping
      return sw.lng >= point.lng && ne.lat >= point.lng;
    } else {
      return sw.lng <= point.lng && ne.lat <= point.lng;
    }
  }

  return false;
}

/**
 * Function that returns true if the input overlaps the context's bound.
 */
export type OverlapsLatLngBoundFunction = ((boundOrPoint: LatLngBound | LatLngPoint) => boolean) & { readonly _bound: LatLngBound };

export function latLngBoundOverlapsLatLngBound(a: LatLngBound, b: LatLngBound): boolean {
  return overlapsLatLngBoundFunction(a)(b);
}

export function overlapsLatLngBoundFunction(bound: LatLngBound): OverlapsLatLngBoundFunction {
  const a: Rectangle = boundToRectangle(bound);

  const fn = ((boundOrPoint: LatLngBound | LatLngPoint) => {
    if (isLatLngPoint(boundOrPoint)) {
      console.log('x', boundOrPoint);
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
