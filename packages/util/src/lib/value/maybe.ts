import { isEmptyIterable, isIterable } from '../iterable/iterable';
import { objectHasNoKeys } from '../object/object';
import { Maybe, MaybeNot, MaybeSo } from './maybe.type';

/**
 * Returns true if the value is not null or undefined.
 *
 * @param value
 * @returns
 */
export function hasNonNullValue<T>(value: Maybe<T>): value is T;
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
 * - empty iterables
 * - empty strings
 * - null/undefined values.
 *
 * NaN has undefined behavior.
 */
export function hasValueOrNotEmpty<T>(value: T): boolean;
export function hasValueOrNotEmpty(value: 0): true;
export function hasValueOrNotEmpty(value: true): true;
export function hasValueOrNotEmpty(value: false): true;
export function hasValueOrNotEmpty(value: number): true;
export function hasValueOrNotEmpty(value: ''): false;
export function hasValueOrNotEmpty(value: {}): true;
export function hasValueOrNotEmpty(value: null): false;
export function hasValueOrNotEmpty(value: undefined): false;
export function hasValueOrNotEmpty(value: unknown): boolean {
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
export function hasValueOrNotEmptyObject<T>(value: T): boolean;
export function hasValueOrNotEmptyObject(value: 0): true;
export function hasValueOrNotEmptyObject(value: true): true;
export function hasValueOrNotEmptyObject(value: false): true;
export function hasValueOrNotEmptyObject(value: number): true;
export function hasValueOrNotEmptyObject(value: ''): false;
export function hasValueOrNotEmptyObject(value: {}): false;
export function hasValueOrNotEmptyObject(value: null): false;
export function hasValueOrNotEmptyObject(value: undefined): false;
export function hasValueOrNotEmptyObject(value: unknown): boolean {
  if (isIterable(value, true)) {
    return !isEmptyIterable(value);
  } else if (isNotNullOrEmptyString(value)) {
    return typeof value === 'object' ? !objectHasNoKeys(value as object) : true;
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
export function isStringOrTrue(value: ''): false;
export function isStringOrTrue(value: false): false;
export function isStringOrTrue(value: null): false;
export function isStringOrTrue(value: undefined): false;
export function isStringOrTrue(value: Maybe<string | boolean>): boolean;
export function isStringOrTrue(value: Maybe<string | boolean>): boolean {
  return Boolean(value || value !== '');
}

/**
 * Returns true if the input is not MaybeNot and not an empty string.
 *
 * @param value
 * @returns
 */
export function isNotNullOrEmptyString<T>(value: ''): false;
export function isNotNullOrEmptyString<T>(value: null): false;
export function isNotNullOrEmptyString<T>(value: undefined): false;
export function isNotNullOrEmptyString<T>(value: Maybe<MaybeNot | '' | T>): value is MaybeSo<T>;
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
