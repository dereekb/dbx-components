import { type Writable } from 'ts-essentials';
import { type MapFunction } from '../value/map';

// MARK: Number
export interface NumberBound<T extends number = number> {
  /**
   * The minimum value.
   */
  readonly min: T;
  /**
   * The maximum value, inclusive.
   */
  readonly max: T;
}

/**
 * Checks whether a {@link NumberBound} is valid (min is less than or equal to max).
 *
 * @param bounds - The bounds to validate
 * @returns `true` if `min <= max`
 */
export function isValidNumberBound(bounds: NumberBound): boolean {
  const { min, max } = bounds;
  return min <= max;
}

export type IsInNumberBoundFunction = (number: number) => boolean;

/**
 * Creates a function that checks whether a number falls within the specified inclusive bounds.
 *
 * @param bounds - The min/max bounds to test against
 * @returns A function that returns `true` if the input number is within bounds
 * @throws Error if the bounds are invalid (min > max)
 */
export function isInNumberBoundFunction(bounds: NumberBound): IsInNumberBoundFunction {
  const { min, max } = bounds;

  if (!isValidNumberBound(bounds)) {
    throw new Error('Invalid bounds. Min was greater than the max.');
  }

  return (input: number) => {
    return input >= min && input <= max;
  };
}

// MARK: Wrap
export interface WrapNumberFunctionConfig<T extends number = number> extends NumberBound<T> {
  /**
   * Whether or not to wrap to the nearest "fencepost" value instead of by direct index.
   *
   * False by default.
   */
  readonly fencePosts?: boolean;
}

export type WrapNumberFunction<T extends number = number> = MapFunction<number, T> & {
  readonly _wrap: WrapNumberFunctionConfig;
};

/**
 * Creates a function that wraps numbers around within the specified bounds, like modular arithmetic.
 *
 * When `fencePosts` is true, wraps to the nearest "fence post" value, extending the wrap range by one in each direction.
 *
 * @param wrapNumberFunctionConfig - Configuration with min, max, and optional fence post behavior
 * @returns A function that wraps input numbers into the bounded range
 */
export function wrapNumberFunction<T extends number = number>(wrapNumberFunctionConfig: WrapNumberFunctionConfig<T>): WrapNumberFunction<T> {
  const { min, max, fencePosts = false } = wrapNumberFunctionConfig;
  const distance = max - min;
  const isInBound = isInNumberBoundFunction(wrapNumberFunctionConfig);

  const fn: Writable<WrapNumberFunction<T>> = ((input: T) => {
    if (isInBound(input)) {
      return input;
    } else {
      // when fencePosts is true, we're wrapping to the nearest fence post, meaning wraps are one value longer increased on that side.
      const fencePostOffset = fencePosts ? (input < min ? 1 : -1) : 0;
      const wrappedValue = ((((input - min) % distance) + distance) % distance) + min + fencePostOffset;
      return wrappedValue;
    }
  }) as WrapNumberFunction<T>;
  fn._wrap = wrapNumberFunctionConfig;
  return fn as WrapNumberFunction<T>;
}

export interface BoundNumberFunctionConfig<T extends number = number> extends NumberBound<T> {
  /**
   * Whether or not to "wrap" values around.
   *
   * Example: Wrapping from -180 to 180
   */
  readonly wrap?: boolean;
}

export type BoundNumberFunction<T extends number = number> = MapFunction<number, T>;

/**
 * Creates a function that constrains numbers within bounds, either by clamping or wrapping.
 *
 * When `wrap` is true, uses modular wrapping. Otherwise, clamps values to the min/max range.
 *
 * @param boundNumberFunctionConfig - Configuration with min, max, and optional wrap behavior
 * @returns A function that bounds input numbers into the configured range
 */
export function boundNumberFunction<T extends number = number>(boundNumberFunctionConfig: BoundNumberFunctionConfig<T>): BoundNumberFunction<T> {
  const { min, max, wrap } = boundNumberFunctionConfig;

  if (wrap) {
    return wrapNumberFunction<T>(boundNumberFunctionConfig);
  } else {
    return (input: number) => boundNumber<T>(input, min, max);
  }
}

/**
 * Clamps the input number between the min and max values (inclusive).
 *
 * @param input - Number to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns The clamped value
 */
export function boundNumber<T extends number = number>(input: number, min: T, max: T): T {
  return Math.max(Math.min(input, max), min) as T;
}
