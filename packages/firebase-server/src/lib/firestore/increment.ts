import { mapObjectMap } from '@dereekb/util';
import { FieldValue } from '@google-cloud/firestore';
import { UpdateData, FirestoreAccessorIncrementUpdate } from '@dereekb/firebase';

/**
 * Creates UpdateData corresponding to the input increment update.
 *
 * @param input
 * @returns
 */
export function firestoreServerIncrementUpdateToUpdateData<T>(input: FirestoreAccessorIncrementUpdate<T>): UpdateData<T> {
  return mapObjectMap(input, (incrementValue) => {
    return FieldValue.increment(incrementValue ?? 0);
  }) as UpdateData<T>;
}
