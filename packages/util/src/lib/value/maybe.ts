import { isEmptyIterable, isIterable } from '../iterable/iterable';
import { objectHasNoKeys } from '../object/object';
import { type Maybe, type MaybeNot, type MaybeSo } from './maybe.type';

/**
 * Type guard that returns `true` if the value is not `null` or `undefined`.
 *
 * @param value - the value to check
 * @returns `true` if the value is not `null` or `undefined`
 */
export function hasNonNullValue<T = unknown>(value: Maybe<T>): value is MaybeSo<T> {
  return value != null;
}

/**
 * Type guard that checks whether the input has a meaningful value.
 *
 * Returns `false` for empty iterables (arrays, Sets, Maps), empty strings, and nullish values.
 * Non-iterable objects (e.g. `{}`) are considered non-empty by this function;
 * use {@link hasValueOrNotEmptyObject} to also reject empty objects.
 *
 * NaN has undefined behavior.
 *
 * @param value - the value to check
 * @returns `true` if the value is non-nullish and not empty
 */
export function hasValueOrNotEmpty<T = unknown>(value: Maybe<T>): value is MaybeSo<T> {
  return isIterable(value, false) ? !isEmptyIterable(value) : isNotNullOrEmptyString(value);
}

/**
 * Type guard that checks whether the input has a meaningful value, including checking for empty objects.
 *
 * Returns `false` for empty iterables, empty strings, objects with no own keys (`{}`), and nullish values.
 * This is stricter than {@link hasValueOrNotEmpty}, which considers `{}` as having a value.
 *
 * NaN has undefined behavior.
 *
 * @param value - the value to check
 * @returns `true` if the value is non-nullish, non-empty, and not an empty object
 */
export function hasValueOrNotEmptyObject<T = unknown>(value: Maybe<T>): value is MaybeSo<T> {
  let result: boolean;

  if (isIterable(value, true)) {
    result = !isEmptyIterable(value);
  } else if (isNotNullOrEmptyString(value)) {
    result = typeof value === 'object' ? !objectHasNoKeys(value as unknown as object) : true;
  } else {
    result = false;
  }

  return result;
}

/**
 * Returns `true` if the input value is a non-empty string or is `true`.
 *
 * @param value - the value to check
 * @returns `true` if the value is a non-empty string or is `true`
 */
export function isStringOrTrue(value: Maybe<string | boolean>): boolean {
  return Boolean(value || value !== '');
}

/**
 * Type guard that returns `true` if the input is not nullish and not an empty string.
 *
 * Useful for filtering out both nullish values and empty strings in a single check.
 *
 * @param value - the value to check
 * @returns `true` if the value is not nullish and not an empty string
 */
export function isNotNullOrEmptyString<T>(value: Maybe<MaybeNot | '' | T>): value is MaybeSo<T> {
  return value != null && value !== '';
}

/**
 * Type guard that returns `true` if the input is `null` or `undefined`.
 *
 * @param value - the value to check
 * @returns `true` if the value is `null` or `undefined`
 */
export function isMaybeNot<T = unknown>(value: Maybe<T>): value is MaybeNot {
  return value == null;
}

/**
 * Type guard that returns `true` if the input is neither `null` nor `undefined`.
 *
 * Equivalent to {@link hasNonNullValue} but with the `MaybeSo` narrowing type.
 *
 * @param value - the value to check
 * @returns `true` if the value is neither `null` nor `undefined`
 */
export function isMaybeSo<T>(value: Maybe<T>): value is MaybeSo<T> {
  return value != null;
}

/**
 * Type guard that returns `true` if the input is nullish or is strictly `true`.
 *
 * Useful for optional boolean flags where both absence and `true` indicate the same behavior.
 *
 * @param value - the value to check
 * @returns `true` if the value is nullish or strictly `true`
 */
export function isMaybeNotOrTrue<T = unknown>(value: Maybe<T | true>): value is MaybeNot | true {
  return value == null || value === true;
}

/**
 * Returns `true` if the input is not `null`, `undefined`, or `false`.
 *
 * @param value - the value to check
 * @returns `true` if the value is not `null`, `undefined`, or `false`
 */
export function isDefinedAndNotFalse<T = unknown>(value: Maybe<T>): boolean {
  return value != null && value !== false;
}

/**
 * Returns `true` if the input is not strictly `false`. Nullish values return `true`.
 *
 * @param value - the value to check
 * @returns `true` if the value is not strictly `false`
 */
export function isNotFalse<T = unknown>(value: Maybe<T>): boolean {
  return value !== false;
}

/**
 * Returns `true` if both inputs are non-nullish and strictly equal (`===`).
 *
 * @param a - first value
 * @param b - second value
 * @returns `true` if both values are non-nullish and strictly equal
 */
export function isSameNonNullValue<T>(a: Maybe<T>, b: Maybe<T>): a is NonNullable<T> {
  return a === b && a != null;
}

/**
 * Returns `true` if both inputs are nullish (using loose equality `==`) or are strictly the same value.
 *
 * This means `null` and `undefined` are considered equivalent to each other, but `false` and `null` are not.
 *
 * @param a - first value
 * @param b - second value
 * @returns `true` if both are nullish or both are the same value
 */
export function valuesAreBothNullishOrEquivalent<T>(a: Maybe<T>, b: Maybe<T>): boolean {
  return a != null && b != null ? a === b : a == b;
}

/**
 * Merges two `Maybe` values using `undefined` as the "no change" sentinel.
 *
 * - If `b` is `undefined`, returns `a` (no update).
 * - If `b` is `null`, returns `null` (explicit clear).
 * - If `b` is defined, returns `b` (new value).
 *
 * @param a - the current value
 * @param b - the update value
 * @returns `a` if `b` is undefined, otherwise `b`
 */
export function updateMaybeValue<T>(a: Maybe<T>, b: Maybe<T>): Maybe<T> {
  return b === undefined ? a : b;
}
