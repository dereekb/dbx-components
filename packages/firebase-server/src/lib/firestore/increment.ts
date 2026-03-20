import { mapObjectMap } from '@dereekb/util';
import { FieldValue } from '@google-cloud/firestore';
import { type UpdateData, type FirestoreAccessorIncrementUpdate } from '@dereekb/firebase';

/**
 * Converts a {@link FirestoreAccessorIncrementUpdate} into Firestore {@link UpdateData} using
 * Google Cloud Firestore's {@link FieldValue.increment}.
 *
 * Each field in the input maps to an atomic increment operation. Null/undefined values default to 0.
 *
 * @param input - The increment specification mapping field names to numeric deltas.
 * @returns Firestore {@link UpdateData} with atomic increment operations.
 *
 * @example
 * ```typescript
 * const updateData = firestoreServerIncrementUpdateToUpdateData<Stats>({
 *   viewCount: 1,
 *   likeCount: -1
 * });
 * ```
 */
export function firestoreServerIncrementUpdateToUpdateData<T extends object>(input: FirestoreAccessorIncrementUpdate<T>): UpdateData<T> {
  return mapObjectMap(input, (incrementValue) => {
    return FieldValue.increment(incrementValue ?? 0);
  }) as UpdateData<T>;
}
