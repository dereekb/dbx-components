import { mapObjectMap, type Maybe } from '@dereekb/util';
import { FieldValue } from '@google-cloud/firestore';
import { type UpdateData, type FirestoreAccessorArrayUpdate } from '@dereekb/firebase';

/**
 * Converts a {@link FirestoreAccessorArrayUpdate} into Firestore {@link UpdateData} using
 * Google Cloud Firestore's {@link FieldValue.arrayUnion} and {@link FieldValue.arrayRemove}.
 *
 * @param input - The array update specification with `union` and/or `remove` field maps.
 * @returns Firestore {@link UpdateData} with array union/remove operations.
 *
 * @example
 * ```typescript
 * const updateData = firestoreServerArrayUpdateToUpdateData<User>({
 *   union: { tags: ['new-tag'] },
 *   remove: { tags: ['old-tag'] }
 * });
 * ```
 */
export function firestoreServerArrayUpdateToUpdateData<T extends object>(input: FirestoreAccessorArrayUpdate<T>): UpdateData<T> {
  const union = input.union;
  const remove = input.remove;

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
