
// MARK: Types
/**
 * A value that might exist, or be null/undefined instead.
 */
export type Maybe<T> = T | null | undefined;

// MARK: Utils
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
