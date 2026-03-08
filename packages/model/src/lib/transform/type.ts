import { type MapStringFunction, type Maybe, splitCommaSeparatedString, stringToBoolean } from '@dereekb/util';
import { type TransformFnParams } from 'class-transformer';

// MARK: String
/**
 * Creates a class-transformer transform function that converts a string value to a boolean.
 *
 * @param defaultValue - optional default when the value is undefined or not parseable
 * @returns a transform function for use with class-transformer's `@Transform` decorator
 *
 * @example
 * ```typescript
 * class MyDto {
 *   @Transform(transformStringToBoolean(false))
 *   isActive?: boolean;
 * }
 * ```
 */
export function transformStringToBoolean(defaultValue?: boolean | undefined): (params: TransformFnParams) => Maybe<boolean> {
  return (params: TransformFnParams) => stringToBoolean(params.value, defaultValue);
}

// MARK: Comma Separated Values
/**
 * Creates a class-transformer transform function that splits a comma-separated string into an array,
 * mapping each element through the provided function. If the value is already an array, it is returned as-is.
 *
 * @param mapFn - function to transform each string element
 * @returns a transform function for use with class-transformer's `@Transform` decorator
 *
 * @example
 * ```typescript
 * class MyDto {
 *   @Transform(transformCommaSeparatedValueToArray(Number))
 *   ids?: number[];
 * }
 * ```
 */
export function transformCommaSeparatedValueToArray<T>(mapFn: MapStringFunction<T>): (params: TransformFnParams) => Maybe<T[]> {
  return (params: TransformFnParams) => {
    let result: Maybe<T[]>;

    if (params.value) {
      if (Array.isArray(params.value)) {
        result = params.value;
      } else {
        result = splitCommaSeparatedString(params.value, mapFn);
      }
    }

    return result;
  };
}

/**
 * Pre-built transform function that splits a comma-separated string into a number array.
 */
export const transformCommaSeparatedNumberValueToArray = transformCommaSeparatedValueToArray((x) => Number(x));

/**
 * Pre-built transform function that splits a comma-separated string into a string array.
 */
export const transformCommaSeparatedStringValueToArray = transformCommaSeparatedValueToArray((x) => x);
