import { mapObjectMap } from '@dereekb/util';
import { type UpdateData, increment } from 'firebase/firestore';
import { type FirestoreAccessorIncrementUpdate } from '../../common/firestore/accessor/accessor';

/**
 * Converts a {@link FirestoreAccessorIncrementUpdate} into Firestore `UpdateData` using the
 * client-side `increment()` FieldValue sentinel.
 *
 * Maps each field in the input to an `increment()` call, defaulting to 0 for `undefined` values.
 *
 * @param input - object mapping field names to their increment amounts
 * @returns Firestore `UpdateData` with `FieldValue.increment()` sentinels
 *
 * @example
 * ```ts
 * const updateData = firestoreClientIncrementUpdateToUpdateData<MyModel>({ viewCount: 1, likeCount: -1 });
 * await updateDoc(docRef, updateData);
 * ```
 */
export function firestoreClientIncrementUpdateToUpdateData<T extends object>(input: FirestoreAccessorIncrementUpdate<T>): UpdateData<T> {
  return mapObjectMap(input, (incrementValue) => {
    return increment(incrementValue ?? 0);
  }) as UpdateData<T>;
}
