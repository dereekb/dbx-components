import { filterFalsyAndEmptyValues, objectHasNoKeys } from '@dereekb/util';
import { type WriteResult } from '../types';
import { type FirestoreAccessorIncrementUpdate, type FirestoreDocumentDataAccessor } from './accessor';

/**
 * Function that applies an atomic increment update to a Firestore document's numeric fields.
 *
 * @template T - The document data type
 */
export type IncrementUpdateWithAccessorFunction<T> = (data: FirestoreAccessorIncrementUpdate<T>) => Promise<WriteResult | void>;

/**
 * Creates a function that atomically increments numeric fields in a Firestore document.
 *
 * The returned function filters out falsy/empty values from the increment data and skips
 * the update entirely if no valid fields remain. This avoids unnecessary Firestore writes.
 *
 * Uses Firestore's built-in atomic increment operation, which is safe for concurrent updates.
 *
 * @param accessor - The document accessor to perform the increment on
 * @returns A function that applies increment updates to the document
 *
 * @see https://cloud.google.com/firestore/docs/samples/firestore-data-set-numeric-increment
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
