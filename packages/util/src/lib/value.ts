
// MARK: Types
/**
 * A value that might exist, or be null/undefined instead.
 */
export type Maybe<T> = T | null | undefined;

/**
 * Converts one value to another.
 */
export type ConversionFunction<I, O> = (input: I) => O;

/**
 * Converts values from the input, and applies them to the target if a target is supplied.
 */
export type ApplyConversionFunction<I, O> = (input: I, target?: Maybe<Partial<O>>) => O;

/**
 * Converts values from the input, and applies them to the target if a target is supplied.
 */
export type ApplyConversionFunctionWithOptions<I, O, C> = (input: I, target?: Maybe<Partial<O>>, config?: C) => O;

// MARK: Utils
/**
 * Returns true if the value is not null or undefined.
 * 
 * @param value 
 * @returns 
 */
export function hasNonNullValue<T>(value: Maybe<T>): value is T;
export function hasNonNullValue(value: any): boolean;
export function hasNonNullValue(value: true): true;
export function hasNonNullValue(value: false): true;
export function hasNonNullValue(value: number): true;
export function hasNonNullValue(value: ''): true;
export function hasNonNullValue(value: null): false;
export function hasNonNullValue(value: undefined): false;
export function hasNonNullValue<T>(value: Maybe<T>): boolean {
  return value != null;
}

/**
 * Whether or not the input has any value.
 * 
 * Will return false for:
 * - empty arrays
 * - empty strings
 * - null/undefined values.
 * 
 * NaN has undefined behavior.
 */
export function hasValueOrNotEmpty(value: any): boolean;
export function hasValueOrNotEmpty(value: true): true;
export function hasValueOrNotEmpty(value: false): true;
export function hasValueOrNotEmpty(value: number): true;
export function hasValueOrNotEmpty(value: ''): false;
export function hasValueOrNotEmpty(value: null): false;
export function hasValueOrNotEmpty(value: undefined): false;
export function hasValueOrNotEmpty(value: any): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  } else {
    return value != null && value !== '';
  }
}

/**
 * True if the input is null/undefined and not false.
 * 
 * @param value 
 * @returns 
 */
export function isUndefinedAndNotFalse(value: any): boolean {
  return value == null && value !== false;
}

/**
 * True if the input is not null/undefined/false.
 * 
 * @param value 
 * @returns 
 */
export function isDefinedAndNotFalse(value: any): boolean {
  return value != null && value !== false;
}

/**
 * Returns true if both the inputs are not null/undefined but the same value.
 * 
 * @param a 
 * @param b 
 * @returns 
 */
export function isSameNonNullValue<T>(a: Maybe<T>, b: Maybe<T>): a is T {
  return (a === b && a != null);
}
