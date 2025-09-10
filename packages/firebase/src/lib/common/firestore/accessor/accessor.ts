import { filterMaybe } from '@dereekb/rxjs';
import { filterUndefinedValues, type KeyValueTransformMap, type Maybe, objectHasNoKeys } from '@dereekb/util';
import { type WriteResult, type SnapshotOptions, type DocumentReference, type DocumentSnapshot, type UpdateData, type WithFieldValue, type PartialWithFieldValue, type SetOptions, type Precondition, type DocumentData, type FirestoreDataConverter } from '../types';
import { from, map, type Observable, type OperatorFunction } from 'rxjs';
import { type DocumentReferenceRef } from '../reference';
import { type PickProperties } from 'ts-essentials';

/**
 * Parameters for document deletion operations.
 */
export interface FirestoreDocumentDeleteParams {
  /**
   * Precondition that must be met for the operation to succeed.
   * Can be used to check document exists or has a specific update time.
   */
  readonly precondition?: Precondition;
}

/**
 * Parameters for document update operations.
 */
export interface FirestoreDocumentUpdateParams {
  /**
   * Precondition that must be met for the operation to succeed.
   * Can be used to check document exists or has a specific update time.
   */
  readonly precondition?: Precondition;
}

/**
 * Used for performing increment operations on numeric fields.
 *
 * Represents a partial object where keys correspond to numeric fields in the document
 * and values represent the amount to increment each field by.
 *
 * @template T - The document type containing numeric fields to increment
 */
export type FirestoreAccessorIncrementUpdate<T> = Partial<KeyValueTransformMap<PickProperties<T, Maybe<number> | number>, number>>;

/**
 * Type of change to perform on an array field.
 */
export type FirestoreAccessorArrayFieldUpdateChangeType = 'union' | 'remove';

/**
 * Used for performing array operations on array fields.
 *
 * Do not provide both a union and remove for the same field. If both a union and remove are provided for a field, only one update (union or remove) will be used. The behavior is not defined.
 *
 * Represents a partial object where keys correspond to array fields in the document
 * and values represent the amount to increment each field by.
 *
 * @template T - The document type containing array field to update
 */
export type FirestoreAccessorArrayUpdate<T> = Partial<Record<FirestoreAccessorArrayFieldUpdateChangeType, FirestoreAccessorArrayFieldUpdate<T>>>;

/**
 * Used for performing array operations on array fields.
 *
 * Represents a partial object where keys correspond to array fields in the document
 * and values represent the amount to increment each field by.
 *
 * @template T - The document type containing array field to update
 */
export type FirestoreAccessorArrayFieldUpdate<T> = Partial<KeyValueTransformMap<PickProperties<T, Maybe<Array<string>> | Array<string>>, Array<string>>> | Partial<KeyValueTransformMap<PickProperties<T, Maybe<Array<number>> | Array<number>>, Array<number>>>;

/**
 * Interface for accessing and modifying a Firestore document.
 *
 * Provides methods for reading, creating, updating, and deleting document data,
 * as well as streaming document snapshots for real-time updates.
 *
 * @template T - The document data type that this accessor will work with
 * @template D - The raw document data type in Firestore (defaults to DocumentData)
 */
export interface FirestoreDocumentDataAccessor<T, D = DocumentData> extends DocumentReferenceRef<T> {
  /**
   * Returns a database stream of DocumentSnapshots.
   */
  stream(): Observable<DocumentSnapshot<T>>;
  /**
   * Creates a document if it does not exist.
   */
  create(data: WithFieldValue<T>): Promise<WriteResult | void>;
  /**
   * Returns the current snapshot.
   */
  get(): Promise<DocumentSnapshot<T>>;
  /**
   * Gets the data from the datastore using the input converter.
   *
   * @param converter
   */
  getWithConverter(converter: null): Promise<DocumentSnapshot<DocumentData>>;
  getWithConverter<U = DocumentData>(converter: null | FirestoreDataConverter<U>): Promise<DocumentSnapshot<U>>;
  /**
   * Whether or not the target object currently exists.
   */
  exists(): Promise<boolean>;
  /**
   * Deletes the document
   */
  delete(params?: FirestoreDocumentDeleteParams): Promise<WriteResult | void>;
  /**
   * Sets the data in the database. Can additionally pass options to configure merging of fields.
   *
   * Set uses the converter to transform the input data.
   *
   * @param data
   */
  set(data: PartialWithFieldValue<T>, options: SetOptions): Promise<WriteResult | void>;
  set(data: WithFieldValue<T>): Promise<WriteResult | void>;
  /**
   * Directly updates the data in the database, skipping the use of the converter, etc.
   *
   * If the input data is undefined or an empty object, it will fail.
   * If the document doesn't exist, it will fail.
   *
   * @param data - The update data to apply
   * @param params - Optional parameters for the update operation
   * @returns A Promise that resolves when the update operation completes
   */
  update(data: UpdateData<D>, params?: FirestoreDocumentUpdateParams): Promise<WriteResult | void>;
  /**
   * Directly updates the data in the database using the input increment, skipping the use of the converter, etc.
   *
   * If the input data is undefined or an empty object, it will fail.
   * If the document doesn't exist, it will fail.
   *
   * @param data - The increment update to apply
   * @param params - Optional parameters for the update operation
   * @returns A Promise that resolves when the update operation completes
   */
  increment(data: FirestoreAccessorIncrementUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<WriteResult | void>;

  /**
   * Updates an array field in the document.
   *
   * @param data - The array update to apply
   * @param params - Optional parameters for the update operation
   * @returns A Promise that resolves when the update operation completes
   */
  arrayUpdate(data: FirestoreAccessorArrayUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<WriteResult | void>;
}

/**
 * Function signature for creating a document.
 *
 * @template T - The document data type
 */
export type FirestoreDocumentDataAccessorCreateFunction<T> = (data: WithFieldValue<T>) => Promise<void | WriteResult>;

/**
 * Function signature for setting document data with optional merge settings.
 *
 * @template T - The document data type
 */
export type FirestoreDocumentDataAccessorSetFunction<T> = (data: PartialWithFieldValue<T> | WithFieldValue<T>, options?: SetOptions) => Promise<void | WriteResult>;

/**
 * Factory interface for creating document accessors for specific document references.
 *
 * Provides a mechanism to create data accessors tailored to specific document references,
 * enabling consistent access patterns across multiple documents.
 *
 * @template T - The document data type that accessors will work with
 * @template D - The raw document data type in Firestore (defaults to DocumentData)
 */
export interface FirestoreDocumentDataAccessorFactory<T, D = DocumentData> {
  /**
   * Creates a new FirestoreDocumentDataAccessor for the input ref.
   *
   * @param ref
   */
  accessorFor(ref: DocumentReference<T>): FirestoreDocumentDataAccessor<T, D>;
}

// MARK: Utility
/**
 * Enumeration of methods for retrieving document data.
 */
export enum FirestoreAccessorStreamMode {
  /**
   * Continuous stream of document snapshots that updates in real-time.
   */
  STREAM = 0,
  /**
   * One-time retrieval of the current document snapshot.
   */
  GET = 1
}

/**
 * Creates an Observable that emits the document data from snapshots based on the specified stream mode.
 *
 * @template T - The document data type
 * @param accessor - The document accessor to retrieve snapshots from
 * @param mode - Whether to use a one-time GET or continuous STREAM mode
 * @param options - Options for how to format the document data
 * @returns An Observable that emits the document data or undefined if the document doesn't exist
 */
export function snapshotStreamDataForAccessor<T>(accessor: FirestoreDocumentDataAccessor<T>, mode: FirestoreAccessorStreamMode, options?: SnapshotOptions): Observable<T | undefined> {
  return dataFromSnapshotStream<T>(snapshotStreamForAccessor(accessor, mode), options);
}

/**
 * Creates an Observable that emits DocumentSnapshots based on the specified stream mode.
 *
 * @template T - The document data type
 * @param accessor - The document accessor to retrieve snapshots from
 * @param mode - Whether to use a one-time GET or continuous STREAM mode
 * @returns An Observable that emits DocumentSnapshots
 */
export function snapshotStreamForAccessor<T>(accessor: FirestoreDocumentDataAccessor<T>, mode: FirestoreAccessorStreamMode): Observable<DocumentSnapshot<T>> {
  return mode === FirestoreAccessorStreamMode.GET ? from(accessor.get()) : accessor.stream();
}

/**
 * Creates an Observable that emits document data from a stream of DocumentSnapshots.
 *
 * Filters out null/undefined values from the stream (documents that don't exist).
 *
 * @template T - The document data type
 * @param stream - Observable that emits DocumentSnapshots
 * @param options - Options for how to format the document data
 * @returns An Observable that emits document data, filtering out non-existent documents
 */
export function dataFromSnapshotStream<T>(stream: Observable<DocumentSnapshot<T>>, options?: SnapshotOptions): Observable<T> {
  return stream.pipe(mapDataFromSnapshot(options), filterMaybe());
}

/**
 * Creates an RxJS operator that transforms DocumentSnapshots into their data.
 *
 * @template T - The document data type
 * @param options - Options for how to format the document data
 * @returns An operator that transforms DocumentSnapshots into document data (or undefined if the document doesn't exist)
 */
export function mapDataFromSnapshot<T>(options?: SnapshotOptions): OperatorFunction<DocumentSnapshot<T>, Maybe<T>> {
  return map((x) => x.data(options));
}

/**
 * Function that updates a document using a data converter to transform the input data.
 *
 * The function handles:
 * - Converting the input data to Firestore format
 * - Skipping updates if the converted data is empty
 * - Applying preconditions to the update operation
 *
 * Note: If the target document doesn't exist, the update will fail.
 *
 * @template T - The document data type
 * @param data - The partial data to update in the document
 * @param params - Optional parameters for the update operation
 * @returns A promise that resolves with the WriteResult or void
 */
export type UpdateWithAccessorUpdateAndConverterFunction<T> = (data: Partial<T>, params?: FirestoreDocumentUpdateParams) => Promise<WriteResult | void>;

/**
 * Creates a function that updates a document using a data converter.
 *
 * The created function:
 * - Filters out undefined values from the input data
 * - Uses the converter to transform data to Firestore format
 * - Skips the update if the resulting data is empty
 * - Applies any provided preconditions to the update
 *
 * @template T - The document data type
 * @param accessor - The document accessor to use for updates
 * @param converter - The data converter to transform input data to Firestore format
 * @returns A function that updates the document with converted data
 */
export function updateWithAccessorUpdateAndConverterFunction<T>(accessor: FirestoreDocumentDataAccessor<T>, converter: FirestoreDataConverter<T>): UpdateWithAccessorUpdateAndConverterFunction<T> {
  return async (data: Partial<T>, params?: FirestoreDocumentUpdateParams) => {
    const updateInput = filterUndefinedValues(data);
    const updateData = converter.toFirestore(updateInput, { merge: true }); // treat it as a merge

    // Only update
    if (!objectHasNoKeys(updateData)) {
      return params != null ? accessor.update(updateData, params) : accessor.update(updateData);
    }
  };
}
