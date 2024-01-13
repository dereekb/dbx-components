import { mapObjectMap } from '@dereekb/util';
import { type UpdateData, increment } from 'firebase/firestore';
import { type FirestoreAccessorIncrementUpdate } from '../../common/firestore/accessor/accessor';

/**
 * Creates UpdateData corresponding to the input increment update.
 *
 * @param input
 * @returns
 */
export function firestoreClientIncrementUpdateToUpdateData<T extends object>(input: FirestoreAccessorIncrementUpdate<T>): UpdateData<T> {
  return mapObjectMap(input, (incrementValue) => {
    return increment(incrementValue ?? 0);
  }) as UpdateData<T>;
}
