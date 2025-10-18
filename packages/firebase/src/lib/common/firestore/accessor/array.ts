import { filterFalsyAndEmptyValues, objectHasNoKeys } from '@dereekb/util';
import { type WriteResult } from '../types';
import { type FirestoreAccessorArrayUpdate, type FirestoreDocumentDataAccessor } from './accessor';

export type ArrayFieldUpdateWithAccessorFunction<T> = (data: FirestoreAccessorArrayUpdate<T>) => Promise<WriteResult | void>;

/**
 * https://cloud.google.com/firestore/docs/samples/firestore-data-set-array-operations-async
 * https://firebase.google.com/docs/firestore/manage-data/add-data#update_elements_in_an_array
 *
 * @param accessor
 * @returns
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
