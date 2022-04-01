import { makeArray, Maybe, performMakeLoop, PromiseUtility } from '@dereekb/util';
import { DocumentSnapshot } from '../types';
import { FirestoreDocument, FirestoreDocumentAccessor } from './document';

export function newDocuments<T, D extends FirestoreDocument<T>>(documentAccessor: FirestoreDocumentAccessor<T, D>, count: number): D[] {
  return makeArray({ count, make: () => documentAccessor.newDocument() });
}

export interface MakeDocumentsParams<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  count: number;
  /**
   * Initializes the input document with the returned data.
   * 
   * This function may also optionally perform tasks with the passed document and return null/undefined.
   */
  init: (i: number, document: D) => Maybe<T> | Promise<Maybe<T>>;
}

/**
 * Makes a number of new documents.
 * 
 * @param documentAccessor 
 * @param make 
 * @returns 
 */
export function makeDocuments<T, D extends FirestoreDocument<T>>(documentAccessor: FirestoreDocumentAccessor<T, D>, make: MakeDocumentsParams<T, D>): Promise<D[]> {
  return performMakeLoop({
    count: make.count,
    make: async (i: number) => {
      const document: D = documentAccessor.newDocument();
      const data = await make.init(i, document);

      if (data != null) {
        await document.accessor.set(data);
      }

      return document;
    }
  });
}

export function getDocumentSnapshots<T, D extends FirestoreDocument<T>>(documents: D[]): Promise<DocumentSnapshot<T>[]> {
  return PromiseUtility.runTasksForValues(documents, (x) => x.accessor.get());
}
