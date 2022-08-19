import { latLngPointFunction, LatLngPoint, LatLngInput, LatLngPrecision, LatLngPointFunction } from './point';

export type LatLngBoundSouthWestPoint = LatLngPoint;
export type LatLngBoundNothEastPoint = LatLngPoint;

export interface LatLngBound {
  sw: LatLngBoundSouthWestPoint;
  ne: LatLngBoundNothEastPoint;
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
