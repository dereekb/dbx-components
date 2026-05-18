import { filterFalsyAndEmptyValues, objectHasNoKeys } from '@dereekb/util';
import { type WriteResult } from '../types';
import { type FirestoreAccessorArrayUpdate, type FirestoreDocumentDataAccessor } from './accessor';

/**
 * Function that applies array union/remove operations to a Firestore document's array fields.
 *
 * @template T - The document data type
 */
export type ArrayFieldUpdateWithAccessorFunction<T> = (data: FirestoreAccessorArrayUpdate<T>) => Promise<WriteResult | void>;

/**
 * Creates a function that performs atomic array field operations (union/remove) on a Firestore document.
 *
 * The returned function filters out falsy/empty values from the update data and skips
 * the operation entirely if no valid fields remain. Uses Firestore's built-in `arrayUnion`
 * and `arrayRemove` operations, which are safe for concurrent updates.
 *
 * @param accessor - Accessor used to apply the array update.
 * @returns Update function that runs the supplied array operations.
 *
 * @see https://firebase.google.com/docs/firestore/manage-data/add-data#update_elements_in_an_array
 *
 * @__NO_SIDE_EFFECTS__
 */
export function arrayUpdateWithAccessorFunction<T>(accessor: FirestoreDocumentDataAccessor<T>): ArrayFieldUpdateWithAccessorFunction<T> {
  return async (data: FirestoreAccessorArrayUpdate<T>) => {
    const updateData = filterFalsyAndEmptyValues(data);

    // Only update
    if (!objectHasNoKeys(updateData)) {
      return accessor.arrayUpdate(updateData);
    }
  };
}
