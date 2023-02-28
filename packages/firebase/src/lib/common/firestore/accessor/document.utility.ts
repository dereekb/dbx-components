import { AsyncGetterOrValue, Maybe, performMakeLoop, PromiseUtility, UseAsync, wrapUseAsyncFunction, useAsync, makeWithFactory, filterMaybeValues } from '@dereekb/util';
import { FirestoreModelId, FirestoreModelKey } from '../collection';
import { DocumentDataWithIdAndKey, DocumentReference, DocumentSnapshot, QuerySnapshot, Transaction } from '../types';
import { FirestoreDocumentData, FirestoreDocument, FirestoreDocumentAccessor, LimitedFirestoreDocumentAccessor, LimitedFirestoreDocumentAccessorContextExtension } from './document';

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
        await document.accessor.create(data);
      }

      return document;
    }
  });
}

export function getDocumentSnapshots<D extends FirestoreDocument<any>>(documents: D[]): Promise<DocumentSnapshot<FirestoreDocumentData<D>>[]> {
  return PromiseUtility.runTasksForValues(documents, (x) => x.accessor.get());
}

export type FirestoreDocumentSnapshotPair<D extends FirestoreDocument<any>> = {
  document: D;
  snapshot: DocumentSnapshot<FirestoreDocumentData<D>>;
};

export function getDocumentSnapshotPair<D extends FirestoreDocument<any>>(document: D): Promise<FirestoreDocumentSnapshotPair<D>> {
  return document.accessor.get().then((snapshot) => ({ document, snapshot }));
}

export function getDocumentSnapshotPairs<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotPair<D>[]> {
  return PromiseUtility.runTasksForValues(documents, getDocumentSnapshotPair);
}

export type FirestoreDocumentSnapshotDataPair<D extends FirestoreDocument<any>> = {
  document: D;
  snapshot: DocumentSnapshot<FirestoreDocumentData<D>>;
  data: Maybe<FirestoreDocumentData<D>>;
};

export function getDocumentSnapshotDataPair<D extends FirestoreDocument<any>>(document: D): Promise<FirestoreDocumentSnapshotDataPair<D>> {
  return document.accessor.get().then((snapshot) => ({ document, snapshot, data: snapshot.data() }));
}

export function getDocumentSnapshotDataPairs<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotDataPair<D>[]> {
  return PromiseUtility.runTasksForValues(documents, getDocumentSnapshotDataPair);
}

export type FirestoreDocumentSnapshotDataTuple<D extends FirestoreDocument<any>> = [D, Maybe<FirestoreDocumentData<D>>];

export function getDocumentSnapshotDataTuples<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotDataTuple<D>[]> {
  return PromiseUtility.runTasksForValues(documents, (document) => document.accessor.get().then((snapshot) => [document, snapshot.data()]));
}

export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[]): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId: true): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId: false): Promise<FirestoreDocumentData<D>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId?: boolean): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[] | FirestoreDocumentData<D>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId = true): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[] | FirestoreDocumentData<D>[]> {
  return getDocumentSnapshots<D>(documents).then((x: DocumentSnapshot<any>[]) => getDataFromDocumentSnapshots<FirestoreDocumentData<D>>(x, withId));
}

export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[]): DocumentDataWithIdAndKey<T>[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId: true): DocumentDataWithIdAndKey<T>[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId: false): T[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId?: boolean): DocumentDataWithIdAndKey<T>[] | T[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId: boolean = true): DocumentDataWithIdAndKey<T>[] | T[] {
  const mapFn = documentDataFunction<T>(withId);
  return filterMaybeValues<T>(snapshots.map(mapFn));
}

export function loadDocumentsForSnapshots<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, snapshots: QuerySnapshot<T>): D[] {
  return snapshots.docs.map((x) => accessor.loadDocument(x.ref));
}

export function loadDocumentsForDocumentReferencesFromValues<I, T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, values: I[], getRef: (value: I) => DocumentReference<T>): D[] {
  return loadDocumentsForDocumentReferences(accessor, values.map(getRef));
}

export const loadDocumentsForValues = loadDocumentsForDocumentReferencesFromValues;

export function loadDocumentsForDocumentReferences<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, refs: DocumentReference<T>[]): D[] {
  return refs.map((x) => accessor.loadDocument(x));
}

export function loadDocumentsForKeysFromValues<I, T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, values: I[], getKey: (value: I) => FirestoreModelKey): D[] {
  return loadDocumentsForKeys(accessor, values.map(getKey));
}

export function loadDocumentsForKeys<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, keys: FirestoreModelKey[]): D[] {
  return keys.map((x) => accessor.loadDocumentForKey(x));
}

export function loadDocumentsForIdsFromValues<I, T, D extends FirestoreDocument<T>>(accessor: FirestoreDocumentAccessor<T, D>, values: I[], getId: (value: I) => FirestoreModelId): D[] {
  return loadDocumentsForIds(accessor, values.map(getId));
}

export function loadDocumentsForIds<T, D extends FirestoreDocument<T>>(accessor: FirestoreDocumentAccessor<T, D>, ids: FirestoreModelId[]): D[] {
  return ids.map((x) => accessor.loadDocumentForId(x));
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
 * Creates the document data from the snapshot.
 *
 * @param snapshot
 * @returns
 */
export function documentData<T>(snapshot: DocumentSnapshot<T>): Maybe<DocumentDataWithIdAndKey<T>>;
export function documentData<T>(snapshot: DocumentSnapshot<T>, withId: true): Maybe<DocumentDataWithIdAndKey<T>>;
export function documentData<T>(snapshot: DocumentSnapshot<T>, withId: false): Maybe<T>;
export function documentData<T>(snapshot: DocumentSnapshot<T>, withId = false): Maybe<T> | Maybe<DocumentDataWithIdAndKey<T>> {
  if (withId) {
    return documentDataWithIdAndKey(snapshot);
  } else {
    return snapshot.data();
  }
}

export type DocumentDataFunction<T> = (snapshot: DocumentSnapshot<T>) => Maybe<T>;
export type DocumentDataWithIdAndKeyFunction<T> = (snapshot: DocumentSnapshot<T>) => Maybe<DocumentDataWithIdAndKey<T>>;

export function documentDataFunction<T>(withId: true): DocumentDataWithIdAndKeyFunction<T>;
export function documentDataFunction<T>(withId: false): DocumentDataFunction<T>;
export function documentDataFunction<T>(withId: boolean): DocumentDataWithIdAndKeyFunction<T> | DocumentDataFunction<T>;
export function documentDataFunction<T>(withId: boolean): DocumentDataWithIdAndKeyFunction<T> | DocumentDataFunction<T> {
  return withId ? documentDataWithIdAndKey : (snapshot) => snapshot.data();
}

/**
 * Creates a DocumentDataWithId from the input DocumentSnapshot. If the data does not exist, returns undefined.
 *
 * @param snapshot
 * @returns
 */
export function documentDataWithIdAndKey<T>(snapshot: DocumentSnapshot<T>): Maybe<DocumentDataWithIdAndKey<T>> {
  const data = snapshot.data() as DocumentDataWithIdAndKey<T>;

  if (data) {
    data.id = snapshot.id; // attach the id to data
    data.key = snapshot.ref.path; // attach the path/key to the data
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
export async function useDocumentSnapshot<D extends FirestoreDocument<any>, O = void>(document: Maybe<D>, use: UseAsync<DocumentSnapshot<FirestoreDocumentData<D>>, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>): Promise<Maybe<O>> {
  const snapshot = await document?.accessor.get();
  return useAsync(snapshot, use, defaultValue);
}

/**
 * MappedUseAsyncFunction to load snapshot data from the input document and use it.
 */
export const useDocumentSnapshotData = wrapUseAsyncFunction(useDocumentSnapshot, (x) => x.data()) as <D extends FirestoreDocument<any>, O = void>(document: Maybe<D>, use: UseAsync<FirestoreDocumentData<D>, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>) => Promise<Maybe<O>>;

// MARK: Key Accessors
export function firestoreModelIdFromDocument<T, D extends FirestoreDocument<T>>(document: D): FirestoreModelId {
  return document.id;
}

export function firestoreModelIdsFromDocuments<T, D extends FirestoreDocument<T>>(documents: D[]): FirestoreModelId[] {
  return documents.map(firestoreModelIdFromDocument);
}

export function firestoreModelKeyFromDocument<T, D extends FirestoreDocument<T>>(document: D): FirestoreModelKey {
  return document.key;
}

export function firestoreModelKeysFromDocuments<T, D extends FirestoreDocument<T>>(documents: D[]): FirestoreModelKey[] {
  return documents.map(firestoreModelKeyFromDocument);
}

export function documentReferenceFromDocument<T, D extends FirestoreDocument<T>>(document: D): DocumentReference<T> {
  return document.documentRef;
}

export function documentReferencesFromDocuments<T, D extends FirestoreDocument<T>>(documents: D[]): DocumentReference<T>[] {
  return documents.map(documentReferenceFromDocument);
}

// MARK: Compat
/**
 * @Deprecated use DocumentDataWithIdAndKeyFunction<T> instead.
 */
export type DocumentDataWithIdFunction<T> = DocumentDataWithIdAndKeyFunction<T>;

/**
 * @deprecated use documentDataWithIdAndKey instead.
 */
export const documentDataWithId = documentDataWithIdAndKey;
