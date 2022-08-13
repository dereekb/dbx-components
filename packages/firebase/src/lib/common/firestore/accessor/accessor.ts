import { filterMaybe } from '@dereekb/rxjs';
import { filterUndefinedValues, KeyValueTransformMap, Maybe, objectHasNoKeys } from '@dereekb/util';
import { WriteResult, SnapshotOptions, DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue, PartialWithFieldValue, SetOptions, Precondition, DocumentData, FirestoreDataConverter } from '../types';
import { map, Observable, OperatorFunction } from 'rxjs';
import { DocumentReferenceRef } from '../reference';
import { PickProperties } from 'ts-essentials';

export interface FirestoreDocumentDeleteParams {
  precondition?: Precondition;
}

export interface FirestoreDocumentUpdateParams {
  precondition?: Precondition;
}

/**
 * Used for performing increment updates.
 *
 * Is an object that contains the amount to increment.
 */
export type FirestoreAccessorIncrementUpdate<T> = Partial<KeyValueTransformMap<PickProperties<T, Maybe<number> | number>, number>>;

/**
 * Firestore database accessor instance used to retrieve and make changes to items in the database.
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
   * @param data
   */
  update(data: UpdateData<D>, params?: FirestoreDocumentUpdateParams): Promise<WriteResult | void>;
  /**
   * Directly updates the data in the database using the input increment, skipping the use of the converter, etc.
   *
   * If the input data is undefined or an empty object, it will fail.
   * If the document doesn't exist, it will fail.
   *
   * @param data
   */
  increment(data: FirestoreAccessorIncrementUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<WriteResult | void>;
}

export type FirestoreDocumentDataAccessorCreateFunction<T> = (data: WithFieldValue<T>) => Promise<void | WriteResult>;
export type FirestoreDocumentDataAccessorSetFunction<T> = (data: PartialWithFieldValue<T> | WithFieldValue<T>, options?: SetOptions) => Promise<void | WriteResult>;

/**
 * Contextual interface used for making a FirestoreDocumentModifier for a specific document.
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
 * Maps data from the given snapshot stream.
 *
 * Maybe values are filtered from the stream until data is provided.
 *
 * @param stream
 * @param options
 * @returns
 */
export function dataFromSnapshotStream<T>(stream: Observable<DocumentSnapshot<T>>, options?: SnapshotOptions): Observable<T> {
  return stream.pipe(mapDataFromSnapshot(options), filterMaybe());
}

/**
 * OperatorFunction to map data from the snapshot.
 *
 * @param options
 * @returns
 */
export function mapDataFromSnapshot<T>(options?: SnapshotOptions): OperatorFunction<DocumentSnapshot<T>, Maybe<T>> {
  return map((x) => x.data(options));
}

/**
 * Updates the target object using the input data that uses the input converter to build data suitable for the update function.
 *
 * If the input data after conversion is empty then returns void.
 *
 * If the target object does not exist, this will fail.
 *
 * @param data
 */
export type UpdateWithAccessorUpdateAndConverterFunction<T> = (data: Partial<T>, params?: FirestoreDocumentUpdateParams) => Promise<WriteResult | void>;

/**
 * Creates an UpdateWithAccessorUpdateAndConverterFunction.
 *
 * @param accessor
 * @param converter
 * @returns
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
