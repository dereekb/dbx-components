import { mapObjectMap, Maybe } from '@dereekb/util';
import { type FieldValue, arrayUnion, arrayRemove } from 'firebase/firestore';
import { type FirestoreAccessorArrayUpdate } from '../../common/firestore/accessor/accessor';
import { type UpdateData } from '../../common/firestore/types';

/**
 * Creates UpdateData corresponding to the input array update.
 *
 * @param input
 * @returns
 */
export function firestoreClientArrayUpdateToUpdateData<T extends object>(input: FirestoreAccessorArrayUpdate<T>): UpdateData<T> {
  const union = input?.union;
  const remove = input?.remove;

  function createUpdatesWithArrayFunction(fieldUpdate: FirestoreAccessorArrayUpdate<T>['union' | 'remove'], arrayUpdateFunction: typeof arrayUnion | typeof arrayRemove): Maybe<UpdateData<T>> {
    let result: UpdateData<T> | undefined;

    if (fieldUpdate) {
      result = mapObjectMap(fieldUpdate, (arrayUpdate) => {
        let result: FieldValue | undefined;

        if (arrayUpdate) {
          result = arrayUpdateFunction(...arrayUpdate); // use spread operator to insert each value as an argument, as "nested arrays" are not allowed in the Firestore
        }

        return result;
      }) as UpdateData<T>;
    }

    return result;
  }

  const updateData: UpdateData<T> = {
    ...createUpdatesWithArrayFunction(union, arrayUnion),
    ...createUpdatesWithArrayFunction(remove, arrayRemove)
  } as UpdateData<T>;

  return updateData;
}
