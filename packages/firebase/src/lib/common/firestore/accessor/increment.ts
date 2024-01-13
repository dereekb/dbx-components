import { filterFalsyAndEmptyValues, objectHasNoKeys } from '@dereekb/util';
import { type WriteResult } from '../types';
import { type FirestoreAccessorIncrementUpdate, type FirestoreDocumentDataAccessor } from './accessor';

export type IncrementUpdateWithAccessorFunction<T> = (data: FirestoreAccessorIncrementUpdate<T>) => Promise<WriteResult | void>;

/**
 * https://cloud.google.com/firestore/docs/samples/firestore-data-set-numeric-increment
 *
 * @param accessor
 * @returns
 */
export function incrementUpdateWithAccessorFunction<T>(accessor: FirestoreDocumentDataAccessor<T>): IncrementUpdateWithAccessorFunction<T> {
  return async (data: FirestoreAccessorIncrementUpdate<T>) => {
    const updateData = filterFalsyAndEmptyValues(data);

    // Only update
    if (!objectHasNoKeys(updateData)) {
      return accessor.increment(updateData);
    }
  };
}
