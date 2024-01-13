import { type Maybe } from '../value/maybe.type';
import { hasValueOrNotEmpty } from '../value/maybe';

/**
 * Recursively function that returns true if the input is not an object or if every key on the object is empty.
 *
 * @param obj
 */
export function objectIsEmpty<T extends object>(obj: Maybe<T>): boolean {
  if (obj != null && typeof obj === 'object') {
    const keys = Object.keys(obj);

    if (keys.length > 0) {
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const value = (obj as T)[key as keyof T];
        const isEmpty = typeof value === 'object' ? objectIsEmpty<object>(value as unknown as Maybe<object>) : !hasValueOrNotEmpty(value);

        if (!isEmpty) {
          return false;
        }
      }
    }
  }

  return true;
}
