import { makeArray, Maybe, performMakeLoop, PromiseUtility } from '@dereekb/util';
import { DocumentReference, DocumentSnapshot, QuerySnapshot, Transaction } from '../types';
import { FirestoreDocument, FirestoreDocumentAccessor, FirestoreDocumentAccessorContextExtension } from './document';

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

export function loadDocumentsForSnapshots<T, D extends FirestoreDocument<T>>(accessor: FirestoreDocumentAccessor<T, D>, snapshots: QuerySnapshot<T>): D[] {
  return snapshots.docs.map(x => accessor.loadDocument(x.ref));
}

export function loadDocumentsForDocumentReferences<T, D extends FirestoreDocument<T>>(accessor: FirestoreDocumentAccessor<T, D>, refs: DocumentReference<T>[]): D[] {
  return refs.map(x => accessor.loadDocument(x));
}

export function loadDocumentsForValues<I, T, D extends FirestoreDocument<T>>(accessor: FirestoreDocumentAccessor<T, D>, values: I[], getRef: (value: I) => DocumentReference<T>): D[] {
  return values.map(x => accessor.loadDocument(getRef(x)));
}


/**
 * Used for loading documents for the input references.
 */
export type FirestoreDocumentLoader<T, D extends FirestoreDocument<T>> = (references: DocumentReference<T>[], transaction?: Transaction) => D[];

/**
 * Used to make a FirestoreDocumentLoader.
 * 
 * @param accessorContext 
 * @returns 
 */
export function firestoreDocumentLoader<T, D extends FirestoreDocument<T>>(accessorContext: FirestoreDocumentAccessorContextExtension<T, D>): FirestoreDocumentLoader<T, D> {
  return (references: DocumentReference<T>[], transaction?: Transaction) => {
    const accessor = (transaction) ? accessorContext.documentAccessorForTransaction(transaction) : accessorContext.documentAccessor();
    return loadDocumentsForDocumentReferences(accessor, references);
  }
}
