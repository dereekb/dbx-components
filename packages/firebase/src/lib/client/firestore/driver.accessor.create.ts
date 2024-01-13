import { type FirestoreDocumentDataAccessor } from '../../common/firestore/accessor/accessor';
import { type WithFieldValue, type WriteResult } from '../../common/firestore/types';

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
