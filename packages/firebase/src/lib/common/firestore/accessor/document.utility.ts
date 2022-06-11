import { AsyncGetterOrValue, Maybe, performMakeLoop, PromiseUtility, UseAsync, wrapUseAsyncFunction, useAsync, makeWithFactory } from '@dereekb/util';
import { DocumentDataWithId, DocumentReference, DocumentSnapshot, QuerySnapshot, Transaction } from '../types';
import { FirestoreDocument, FirestoreDocumentAccessor, LimitedFirestoreDocumentAccessor, LimitedFirestoreDocumentAccessorContextExtension } from './document';

export function newDocuments<T, D extends FirestoreDocument<T>>(documentAccessor: FirestoreDocumentAccessor<T, D>, count: number): D[] {
  return makeWithFactory(() => documentAccessor.newDocument(), count);
}

export interface MakeDocumentsParams<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  count: number;

  /**
   * Optional override to create a new document using the input accessor.
   */
  newDocument?: (documentAccessor: FirestoreDocumentAccessor<T, D>) => D;

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
  const newDocumentFn = make.newDocument ?? (() => documentAccessor.newDocument());
  return performMakeLoop({
    count: make.count,
    make: async (i: number) => {
      const document: D = newDocumentFn(documentAccessor);
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

export function loadDocumentsForSnapshots<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, snapshots: QuerySnapshot<T>): D[] {
  return snapshots.docs.map((x) => accessor.loadDocument(x.ref));
}

export function loadDocumentsForDocumentReferences<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, refs: DocumentReference<T>[]): D[] {
  return refs.map((x) => accessor.loadDocument(x));
}

export function loadDocumentsForValues<I, T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, values: I[], getRef: (value: I) => DocumentReference<T>): D[] {
  return values.map((x) => accessor.loadDocument(getRef(x)));
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
export function firestoreDocumentLoader<T, D extends FirestoreDocument<T>>(accessorContext: LimitedFirestoreDocumentAccessorContextExtension<T, D>): FirestoreDocumentLoader<T, D> {
  return (references: DocumentReference<T>[], transaction?: Transaction) => {
    const accessor = transaction ? accessorContext.documentAccessorForTransaction(transaction) : accessorContext.documentAccessor();
    return loadDocumentsForDocumentReferences(accessor, references);
  };
}

/**
 * Creates a DocumentDataWithId from the input DocumentSnapshot. If the data does not exist, returns undefined.
 *
 * @param snapshot
 * @returns
 */
export function documentDataWithId<T>(snapshot: DocumentSnapshot<T>): Maybe<DocumentDataWithId<T>> {
  const data = snapshot.data() as DocumentDataWithId<T>;

  if (data) {
    data.id = snapshot.id; // attach the id to data
  }

  return data;
}

/**
 * MappedUseAsyncFunction to load a snapshot from the input document and use it.
 *
 * @param document
 * @param use
 * @param defaultValue
 * @returns
 */
export async function useDocumentSnapshot<T, D extends FirestoreDocument<T>, O = void>(document: Maybe<D>, use: UseAsync<DocumentSnapshot<T>, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>): Promise<Maybe<O>> {
  const snapshot = await document?.accessor.get();
  return useAsync(snapshot, use, defaultValue);
}

/**
 * MappedUseAsyncFunction to load snapshot data from the input document and use it.
 */
export const useDocumentSnapshotData = wrapUseAsyncFunction(useDocumentSnapshot, (x) => x.data());
