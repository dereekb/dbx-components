import { isEmptyIterable, isIterable } from '../iterable/iterable';
import { objectHasNoKeys } from '../object/object';
import { Maybe, MaybeNot, MaybeSo } from './maybe.type';

/**
 * Returns true if the value is not null or undefined.
 *
 * @param value
 * @returns
 */
export function hasNonNullValue<T = unknown>(value: Maybe<T>): value is MaybeSo<T> {
  return value != null;
}

/**
 * Whether or not the input has any value.
 *
 * Will return false for:
 * - empty iterables
 * - empty strings
 * - null/undefined values.
 *
 * NaN has undefined behavior.
 */
export function hasValueOrNotEmpty<T = unknown>(value: Maybe<T>): value is MaybeSo<T> {
  if (isIterable(value, true)) {
    return !isEmptyIterable(value);
  } else {
    return isNotNullOrEmptyString(value);
  }
}

/**
 * Whether or not the input has any value.
 *
 * Will return false for:
 * - empty iterables
 * - empty strings
 * - empty objects (no keys)
 * - null/undefined values.
 *
 * NaN has undefined behavior.
 */
export function hasValueOrNotEmptyObject<T = unknown>(value: Maybe<T>): value is MaybeSo<T> {
  if (isIterable(value, true)) {
    return !isEmptyIterable(value);
  } else if (isNotNullOrEmptyString(value)) {
    return typeof value === 'object' ? !objectHasNoKeys(value as unknown as object) : true;
  } else {
    return false;
  }
}

/**
 * Returns true if the input value is a non-empty string or is true.
 *
 * @param value
 * @returns
 */
export function isStringOrTrue(value: Maybe<string | boolean>): boolean {
  return Boolean(value || value !== '');
}

/**
 * Returns true if the input is not MaybeNot and not an empty string.
 *
 * @param value
 * @returns
 */
export function isNotNullOrEmptyString<T>(value: Maybe<MaybeNot | '' | T>): value is MaybeSo<T> {
  return value != null && value !== '';
}

/**
 * True if the input is MaybeNot.
 *
 * @param value
 * @returns
 */
export function isMaybeNot(value: unknown): value is MaybeNot {
  return value == null;
}

/**
 * True if the input is MaybeSo
 *
 * @param value
 * @returns
 */
export function isMaybeSo<T>(value: Maybe<T>): value is MaybeSo<T> {
  return value != null;
}

/**
 * True if the input is MaybeNot and true.
 *
 * @param value
 * @returns
 */
export function isMaybeNotOrTrue(value: unknown): value is MaybeNot | true {
  return value == null || value === true;
}

/**
 * True if the input is not null/undefined/false.
 *
 * @param value
 * @returns
 */
export function isDefinedAndNotFalse(value: unknown): boolean {
  return value != null && value !== false;
}

/**
 * Returns true if both the inputs are not null/undefined but the same value.
 *
 * @param a
 * @param b
 * @returns
 */
export function isSameNonNullValue<T>(a: Maybe<T>, b: Maybe<T>): a is NonNullable<T> {
  return a === b && a != null;
}
