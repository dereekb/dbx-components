import { Writable } from 'ts-essentials';
import { MapFunction } from '../value/map';

// MARK: Number
export interface NumberBound<T extends number = number> {
  min: T;
  max: T;
}

export function isValidNumberBound(bounds: NumberBound): boolean {
  const { min, max } = bounds;
  return min < max;
}

export type IsInNumberBoundFunction = (number: number) => boolean;

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
export type WrapNumberFunctionConfig<T extends number = number> = NumberBound<T>;

export type WrapNumberFunction<T extends number = number> = MapFunction<number, T> & {
  readonly _wrap: WrapNumberFunctionConfig;
};

export function wrapNumberFunction<T extends number = number>(wrapNumberFunctionConfig: WrapNumberFunctionConfig<T>): WrapNumberFunction<T> {
  const { min, max } = wrapNumberFunctionConfig;
  const distance = max - min;
  const offset = 0 - min;

  const isInBound = isInNumberBoundFunction(wrapNumberFunctionConfig);

  const fn: Writable<WrapNumberFunction<T>> = ((input: T) => {
    if (isInBound(input)) {
      return input;
    } else {
      const relativeOffset = input < min ? -offset : offset;
      const normal = (input + relativeOffset) % distance;
      return normal - relativeOffset;
    }
  }) as WrapNumberFunction<T>;
  fn._wrap = wrapNumberFunctionConfig;
  return fn as WrapNumberFunction<T>;
}

export interface BoundNumberFunctionConfig<T extends number = number> extends NumberBound<T> {
  /**
   * Whether or not to "wrap" values around. Example: Wrapping from -180 to 180
   */
  wrap?: boolean;
}

export type BoundNumberFunction<T extends number = number> = MapFunction<number, T>;

export function boundNumberFunction<T extends number = number>(boundNumberFunctionConfig: BoundNumberFunctionConfig<T>): BoundNumberFunction<T> {
  const { min, max, wrap } = boundNumberFunctionConfig;

  if (wrap) {
    return wrapNumberFunction<T>(boundNumberFunctionConfig);
  } else {
    return (input: number) => Math.max(Math.min(input, max), min) as T;
  }
}
