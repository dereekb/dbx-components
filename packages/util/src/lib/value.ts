
// MARK: Types
/**
 * A value that might exist, or be null/undefined instead.
 */
export type Maybe<T> = T | null | undefined;

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
 * Returns true if both the inputs are not null/undefined but the same value.
 * 
 * @param a 
 * @param b 
 * @returns 
 */
export function isSameNonNullValue<T>(a: Maybe<T>, b: Maybe<T>): a is T {
  return (a === b && a != null);
}
