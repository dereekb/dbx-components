import { type MapStringFunction } from '@dereekb/util';
import { Transform } from 'class-transformer';
import { transformCommaSeparatedValueToArray, transformCommaSeparatedStringValueToArray, transformCommaSeparatedNumberValueToArray, transformStringToBoolean } from './type';

// MARK: Transform Annotations
/**
 * Class-transformer decorator that splits a comma-separated string value into an array using a custom mapping function.
 *
 * @param mapFn - function to transform each string element
 * @returns a property decorator
 *
 * @example
 * ```typescript
 * class MyDto {
 *   @TransformCommaSeparatedValueToArray(Number)
 *   ids?: number[];
 * }
 * ```
 */
export function TransformCommaSeparatedValueToArray<T>(mapFn: MapStringFunction<T>) {
  return Transform(transformCommaSeparatedValueToArray(mapFn));
}

/**
 * Class-transformer decorator that splits a comma-separated string into a string array.
 */
export const TransformCommaSeparatedStringValueToArray = () => Transform(transformCommaSeparatedStringValueToArray);

/**
 * Class-transformer decorator that splits a comma-separated string into a number array.
 */
export const TransformCommaSeparatedNumberValueToArray = () => Transform(transformCommaSeparatedNumberValueToArray);

/**
 * Class-transformer decorator that converts a string value to a boolean.
 */
export const TransformStringValueToBoolean = () => Transform(transformStringToBoolean());
