import { type FirestoreDocumentDataAccessor } from '../../common/firestore/accessor/accessor';
import { type WithFieldValue, type WriteResult } from '../../common/firestore/types';

/**
 * Returns a function that creates a document only if it does not already exist.
 *
 * Used by client-side accessor implementations (default, transaction) as their `create()` method.
 * Checks for document existence first, then calls `set()` if the document is absent.
 *
 * @param accessor - the accessor to perform the existence check and set operation on
 * @throws {Error} When the document already exists at the reference path
 *
 * @example
 * ```ts
 * const create = createWithAccessor(accessor);
 * await create({ name: 'New Item' }); // throws if document already exists
 * ```
 */
export function createWithAccessor<T>(accessor: FirestoreDocumentDataAccessor<T>): (data: WithFieldValue<T>) => Promise<void | WriteResult> {
  return (data: WithFieldValue<T>) => {
    return accessor.exists().then((exists) => {
      if (exists) {
        throw new Error('document exists');
      } else {
        return accessor.set(data);
      }
    });
  };
}
