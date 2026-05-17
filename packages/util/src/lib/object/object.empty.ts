import { type Maybe } from '../value/maybe.type';
import { hasValueOrNotEmpty } from '../value/maybe';

/**
 * Recursively checks whether an object is "empty" — meaning it is null/undefined, has no keys,
 * or all of its values are themselves empty (recursively for nested objects, or falsy for primitives).
 *
 * @dbxUtil
 * @dbxUtilCategory object
 * @dbxUtilTags object, empty, recursive, deep, check, has-value
 * @dbxUtilRelated object-has-no-keys, has-value-or-not-empty-object
 *
 * @param obj - Object to check
 * @returns `true` if the object is considered empty
 */
export function objectIsEmpty<T extends object>(obj: Maybe<T>): boolean {
  let empty = true;

  if (obj != null && typeof obj === 'object') {
    const keys = Object.keys(obj);

    if (keys.length > 0) {
      for (const key of keys) {
        const value = (obj as T)[key as keyof T];
        const isEmpty = typeof value === 'object' ? objectIsEmpty<object>(value as unknown as Maybe<object>) : !hasValueOrNotEmpty(value);

        if (!isEmpty) {
          empty = false;
          break;
        }
      }
    }
  }

  return empty;
}
