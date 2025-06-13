import { mapObjectMap, Maybe } from '@dereekb/util';
import { FieldValue } from '@google-cloud/firestore';
import { type UpdateData, type FirestoreAccessorArrayUpdate } from '@dereekb/firebase';

/**
 * Creates UpdateData corresponding to the input array update.
 *
 * @param input
 * @returns
 */
export function firestoreServerArrayUpdateToUpdateData<T extends object>(input: FirestoreAccessorArrayUpdate<T>): UpdateData<T> {
  const union = input?.union;
  const remove = input?.remove;

  function createUpdatesWithArrayFunction(fieldUpdate: FirestoreAccessorArrayUpdate<T>['union' | 'remove'], arrayUpdateFunction: typeof FieldValue.arrayUnion | typeof FieldValue.arrayRemove): Maybe<UpdateData<T>> {
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
    ...createUpdatesWithArrayFunction(union, FieldValue.arrayUnion),
    ...createUpdatesWithArrayFunction(remove, FieldValue.arrayRemove)
  } as UpdateData<T>;

  return updateData;
}
