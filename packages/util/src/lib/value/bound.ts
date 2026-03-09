import { type Maybe } from '../value/maybe.type';
import { type Rectangle, rectangleOverlapsRectangle, type Vector } from './vector';
import { type Writable } from 'ts-essentials';
import { latLngPointFunction, type LatLngPoint, type LatLngPointInput, type LatLngPrecision, type LatLngPointFunction, isLatLngPoint, isSameLatLngPoint, diffLatLngPoints, TOTAL_LONGITUDE_RANGE, copyLatLngPoint } from './point';
import { type DecisionFunction } from './decision';
import { asArray, type ArrayOrValue, firstValue } from '../array';

/**
 * Alias for the south-west corner point of a {@link LatLngBound}.
 */
export type LatLngBoundSouthWestPoint = LatLngPoint;

/**
 * Alias for the north-east corner point of a {@link LatLngBound}.
 */
export type LatLngBoundNothEastPoint = LatLngPoint;

/**
 * A geographic bounding box defined by its south-west and north-east corner points.
 *
 * Used throughout the library for spatial queries, overlap detection, and map viewport calculations.
 */
export interface LatLngBound {
  sw: LatLngBoundSouthWestPoint;
  ne: LatLngBoundNothEastPoint;
}

/**
 * A value that is either a {@link LatLngBound} or a {@link LatLngPoint}.
 */
export type LatLngBoundOrPoint = LatLngBound | LatLngPoint;

/**
 * Type guard that checks whether the input is a {@link LatLngBound} by testing for the presence of `sw` and `ne` properties.
 */
export function isLatLngBound(input: LatLngBound | unknown): input is LatLngBound {
  return typeof input === 'object' && (input as LatLngBound).sw != null && (input as LatLngBound).ne != null;
}

/**
 * Creates a deep copy of the bound so that mutations to the copy do not affect the original.
 *
 * @param input - bound to copy
 * @returns a new bound with copied corner points
 */
export function copyLatLngBound(input: LatLngBound): LatLngBound {
  return { sw: copyLatLngPoint(input.sw), ne: copyLatLngPoint(input.ne) };
}

/**
 * Checks whether two bounds are identical by comparing both corner points.
 *
 * @param a - first bound
 * @param b - second bound
 * @returns `true` if both the `sw` and `ne` corners are the same
 */
export function isSameLatLngBound(a: LatLngBound, b: LatLngBound): boolean {
  return isSameLatLngPoint(a.sw, b.sw) && isSameLatLngPoint(a.ne, b.ne);
}

/**
 * Computes the difference between the `ne` and `sw` corner points of a bound, giving the span in latitude and longitude.
 *
 * @param bounds - bound to measure
 * @param wrap - whether to wrap the difference across the antimeridian
 * @returns a point whose `lat`/`lng` represent the span of the bound
 */
export function diffLatLngBoundPoints(bounds: LatLngBound, wrap = false): LatLngPoint {
  return diffLatLngPoints(bounds.ne, bounds.sw, wrap);
}

/**
 * Returns true if the input LatLngBound either strictly wraps the map or fully wraps the map.
 *
 * A bound "wraps" when it crosses the antimeridian (longitude +/-180), requiring special handling
 * for containment and overlap checks.
 *
 * @param bound - bound to check
 * @returns `true` if the bound wraps the map in either sense
 */
export function latLngBoundWrapsMap(bound: LatLngBound) {
  return latLngBoundStrictlyWrapsMap(bound) || latLngBoundFullyWrapsMap(bound);
}

/**
 * Returns true if the input LatLngBound's sw corner comes after the ne corner longitudinally,
 * indicating the bound crosses the antimeridian.
 *
 * @param bound - bound to check
 * @returns `true` if the sw longitude is greater than the ne longitude
 */
export function latLngBoundStrictlyWrapsMap(bound: LatLngBound) {
  return bound.sw.lng > bound.ne.lng;
}

/**
 * Returns true if the LatLngBound's longitudinal span exceeds the total longitude range (360 degrees),
 * meaning the bound covers the entire map horizontally.
 *
 * @param bound - bound to check
 * @returns `true` if the absolute longitude difference exceeds the total longitude range
 */
export function latLngBoundFullyWrapsMap(bound: LatLngBound) {
  return Math.abs(bound.ne.lng - bound.sw.lng) > TOTAL_LONGITUDE_RANGE;
}

/**
 * Returns the north-east corner point of the bound.
 *
 * @param bound - bound to read
 * @returns the `ne` corner point
 */
export function latLngBoundNorthEastPoint(bound: LatLngBound): LatLngPoint {
  return bound.ne;
}

/**
 * Derives the north-west corner point from the bound's `ne` latitude and `sw` longitude.
 *
 * @param bound - bound to read
 * @returns the computed north-west corner point
 */
export function latLngBoundNorthWestPoint(bound: LatLngBound): LatLngPoint {
  return { lat: bound.ne.lat, lng: bound.sw.lng };
}

/**
 * Derives the south-east corner point from the bound's `sw` latitude and `ne` longitude.
 *
 * @param bound - bound to read
 * @returns the computed south-east corner point
 */
export function latLngBoundSouthEastPoint(bound: LatLngBound): LatLngPoint {
  return { lat: bound.sw.lat, lng: bound.ne.lng };
}

/**
 * Returns the south-west corner point of the bound.
 *
 * @param bound - bound to read
 * @returns the `sw` corner point
 */
export function latLngBoundSouthWestPoint(bound: LatLngBound): LatLngPoint {
  return bound.sw;
}

/**
 * Computes the geographic center of the bound by averaging the corner coordinates.
 *
 * @param bound - bound to compute the center of
 * @returns the center point
 *
 * @example
 * ```ts
 * const bound = latLngBound({ lat: 0, lng: 0 }, { lat: 40, lng: 40 });
 * const center = latLngBoundCenterPoint(bound);
 * // center.lat === 20, center.lng === 20
 * ```
 */
export function latLngBoundCenterPoint(bound: LatLngBound): LatLngPoint {
  const { sw, ne } = bound;
  const lat = (sw.lat + ne.lat) / 2;
  const lng = (sw.lng + ne.lng) / 2;
  return { lat, lng };
}

/**
 * Returns the northern latitude boundary (the `ne` latitude).
 *
 * @param bound - bound to read
 * @returns the latitude of the north edge
 */
export function latLngBoundNorthBound(bound: LatLngBound): number {
  return bound.ne.lat;
}

/**
 * Returns the southern latitude boundary (the `sw` latitude).
 *
 * @param bound - bound to read
 * @returns the latitude of the south edge
 */
export function latLngBoundSouthBound(bound: LatLngBound): number {
  return bound.sw.lat;
}

/**
 * Returns the eastern longitude boundary (the `ne` longitude).
 *
 * @param bound - bound to read
 * @returns the longitude of the east edge
 */
export function latLngBoundEastBound(bound: LatLngBound): number {
  return bound.ne.lng;
}

/**
 * Returns the western longitude boundary (the `sw` longitude).
 *
 * @param bound - bound to read
 * @returns the longitude of the west edge
 */
export function latLngBoundWestBound(bound: LatLngBound): number {
  return bound.sw.lng;
}

/**
 * Tuple of the sw corner and the north east point.
 */
export type LatLngBoundTuple = [LatLngBoundSouthWestPoint | LatLngPointInput, LatLngBoundNothEastPoint | LatLngPointInput];

/**
 * Tuple of four points that define the corners of a bounding box, from which the min/max extents are derived.
 */
export type LatLngBoundTuplePoints = [LatLngPointInput, LatLngPointInput, LatLngPointInput, LatLngPointInput];

/**
 * Accepted input types for creating a {@link LatLngBound}: a bound object, a 2-element tuple (sw/ne), or a 4-element tuple of corner points.
 */
export type LatLngBoundInput = LatLngBound | LatLngBoundTuple | LatLngBoundTuplePoints;

// MARK: BoundTuple
/**
 * Convenience function that creates a {@link LatLngBoundTuple} using the default configuration.
 *
 * @param input - a sw point or any bound input
 * @param inputNe - optional ne point when providing two separate points
 * @returns a tuple of `[sw, ne]` points
 */
export function latLngBoundTuple(input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint): LatLngBoundTuple {
  return latLngBoundTupleFunction()(input, inputNe);
}

/**
 * Converts the input to a {@link LatLngBoundTuple}. Accepts the same flexible input types as {@link LatLngBoundFunction}.
 */
export type LatLngBoundTupleFunction = ((input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint) => LatLngBoundTuple) & ((sw: LatLngBoundSouthWestPoint, ne: LatLngBoundNothEastPoint) => LatLngBoundTuple) & ((bound: LatLngBoundInput) => LatLngBoundTuple);

export type LatLngBoundTupleFunctionConfig = LatLngBoundFunctionConfig;

/**
 * Creates a {@link LatLngBoundTupleFunction} that converts various bound inputs into a `[sw, ne]` tuple,
 * applying optional precision to the resulting points.
 *
 * @param config - optional configuration for point precision
 * @returns a function that produces bound tuples from flexible inputs
 */
export function latLngBoundTupleFunction(config?: LatLngBoundTupleFunctionConfig): LatLngBoundTupleFunction {
  const fn = latLngBoundFunction(config);
  return (input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint) => {
    const latLngBound: LatLngBound = fn(input, inputNe);
    return [latLngBound.sw, latLngBound.ne];
  };
}

// MARK: Bound
/**
 * Convenience function that creates a {@link LatLngBound} using the default configuration.
 *
 * @param input - a sw point or any bound input
 * @param inputNe - optional ne point when providing two separate points
 * @returns a bound object
 *
 * @example
 * ```ts
 * const bound = latLngBound({ lat: 0, lng: 0 }, { lat: 40, lng: 40 });
 * // bound.sw.lat === 0, bound.ne.lat === 40
 * ```
 */
export function latLngBound(input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint): LatLngBound {
  return latLngBoundFunction()(input, inputNe);
}

/**
 * Converts various input types to a {@link LatLngBound}. Accepts two separate points, a bound object, a 2-element tuple, or a 4-element tuple.
 */
export type LatLngBoundFunction = ((input: LatLngBoundSouthWestPoint | LatLngBoundInput, inputNe?: LatLngBoundNothEastPoint) => LatLngBound) & ((sw: LatLngBoundSouthWestPoint, ne: LatLngBoundNothEastPoint) => LatLngBound) & ((bound: LatLngBoundInput) => LatLngBound);

/**
 * Configuration for creating a {@link LatLngBoundFunction}.
 */
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

/**
 * Creates a {@link LatLngBoundFunction} that normalizes various bound input formats into a {@link LatLngBound}.
 *
 * Supports creating bounds from: two separate points, a `[sw, ne]` tuple, a four-point tuple (computes min/max extents),
 * or a pre-existing bound object.
 *
 * @param config - optional configuration for point precision and custom point functions
 * @returns a function that produces bounds from flexible inputs
 * @throws {Error} when the input cannot be parsed into a valid bound
 *
 * @example
 * ```ts
 * const fn = latLngBoundFunction({ precision: 3 });
 * const result = fn([{ lat: 20, lng: 20 }, { lat: 30, lng: 30 }]);
 * // result.sw.lat === 20, result.ne.lat === 30
 * ```
 */
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
 * Input type for {@link extendLatLngBound}: a single bound/point or an array of them.
 */
export type ExtendLatLngBoundInput = ArrayOrValue<LatLngBoundOrPoint>;

/**
 * Creates a {@link LatLngBound} from the input, which may be a single point, a single bound, or an array of points/bounds.
 *
 * When given an array, the first element seeds the initial bound and subsequent elements extend it.
 *
 * @param input - one or more points/bounds to derive the bounding box from
 * @returns the computed bound, or `undefined` if the input is empty
 *
 * @example
 * ```ts
 * const bound = latLngBoundFromInput([
 *   { lat: 0, lng: 0 },
 *   { lat: 40, lng: 40 }
 * ]);
 * // bound covers from (0,0) to (40,40)
 * ```
 */
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

/**
 * Extends an existing bound to include all the given points and/or bounds.
 *
 * The returned bound's `sw` corner uses the minimum lat/lng encountered, and its `ne` corner uses the maximum.
 *
 * @param bound - the starting bound to extend
 * @param extendWith - one or more points/bounds to include
 * @returns a new bound that encompasses the original and all extensions
 */
export function extendLatLngBound(bound: LatLngBound, extendWith: ExtendLatLngBoundInput): LatLngBound {
  const { sw, ne } = copyLatLngBound(bound);

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

/**
 * A decision function that checks whether a point or bound satisfies a spatial condition against a reference bound.
 */
export type LatLngBoundCheckFunction = DecisionFunction<LatLngBoundOrPoint>;

/**
 * Function that returns true if the input is entirely within the context's bound.
 *
 * Exposes the reference bound via the `_bound` property.
 */
export type IsWithinLatLngBoundFunction = LatLngBoundCheckFunction & { readonly _bound: LatLngBound };

/**
 * Creates an {@link IsWithinLatLngBoundFunction} that checks if a given point or bound
 * falls entirely within the specified bound. Points are checked directly; bounds require
 * both corners to be within.
 *
 * @param bound - the reference bound to check containment against
 * @returns a function that returns `true` if the input is within the reference bound
 */
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

/**
 * Checks whether one bound is entirely contained within another by verifying both its corners are within the outer bound.
 *
 * @param bound - the inner bound to test
 * @param within - the outer bound to test against
 * @returns `true` if both corners of `bound` are within `within`
 */
export function isLatLngBoundWithinLatLngBound(bound: LatLngBound, within: LatLngBound): boolean {
  return isLatLngPointWithinLatLngBound(bound.sw, within) && isLatLngPointWithinLatLngBound(bound.ne, within);
}

/**
 * Checks whether a point lies within a bound. Handles bounds that wrap the antimeridian by checking
 * if the longitude falls on either side of the wrap.
 *
 * @param point - the point to test
 * @param within - the bound to test against
 * @returns `true` if the point is within the bound
 *
 * @example
 * ```ts
 * const bound = latLngBound({ lat: 0, lng: 0 }, { lat: 40, lng: 40 });
 * isLatLngPointWithinLatLngBound(latLngPoint(10, 10), bound);
 * // true
 * ```
 */
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
 *
 * Exposes the reference bound via the `_bound` property.
 */
export type OverlapsLatLngBoundFunction = LatLngBoundCheckFunction & { readonly _bound: LatLngBound };

/**
 * Checks whether two bounds overlap each other.
 *
 * @param a - the first bound
 * @param b - the second bound
 * @returns `true` if the bounds overlap
 */
export function latLngBoundOverlapsLatLngBound(a: LatLngBound, b: LatLngBound): boolean {
  return overlapsLatLngBoundFunction(a)(b);
}

/**
 * Creates an {@link OverlapsLatLngBoundFunction} that checks whether a given point or bound
 * overlaps the reference bound. Internally converts bounds to rectangles for overlap detection,
 * handling antimeridian wrapping.
 *
 * @param bound - the reference bound to check overlap against
 * @returns a function that returns `true` if the input overlaps the reference bound
 */
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

/**
 * The total span of longitude in degrees (360).
 */
export const TOTAL_SPAN_OF_LONGITUDE = 360;

/**
 * Normalizes a {@link LatLngBound} into a {@link Rectangle} in an arbitrary coordinate space
 * where the left edge (-180 longitude) begins at x=360. This allows safe rectangle-based
 * overlap comparisons without worrying about antimeridian wrapping.
 *
 * @param bound - the geographic bound to convert
 * @returns a rectangle suitable for overlap calculations
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
