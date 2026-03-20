import { mapObjectMap, type Maybe } from '@dereekb/util';
import { type FieldValue, arrayUnion, arrayRemove } from 'firebase/firestore';
import { type FirestoreAccessorArrayUpdate } from '../../common/firestore/accessor/accessor';
import { type UpdateData } from '../../common/firestore/types';

/**
 * Converts a {@link FirestoreAccessorArrayUpdate} into Firestore `UpdateData` using the
 * client-side `arrayUnion()` and `arrayRemove()` FieldValue sentinels.
 *
 * Processes both `union` (add elements) and `remove` (delete elements) operations,
 * spreading array values as individual arguments since Firestore does not allow nested arrays.
 *
 * @param input - object with `union` and/or `remove` maps from field names to arrays of values
 * @returns Firestore `UpdateData` with `FieldValue.arrayUnion()`/`FieldValue.arrayRemove()` sentinels
 *
 * @example
 * ```ts
 * const updateData = firestoreClientArrayUpdateToUpdateData<MyModel>({
 *   union: { tags: ['newTag'] },
 *   remove: { tags: ['oldTag'] }
 * });
 * await updateDoc(docRef, updateData);
 * ```
 */
export function firestoreClientArrayUpdateToUpdateData<T extends object>(input: FirestoreAccessorArrayUpdate<T>): UpdateData<T> {
  const union = input.union;
  const remove = input.remove;

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
