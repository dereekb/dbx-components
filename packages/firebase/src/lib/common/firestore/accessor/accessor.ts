import { filterMaybe } from '@dereekb/rxjs';
import { filterUndefinedValues, Maybe, objectHasNoKeys } from '@dereekb/util';
import { WriteResult, SnapshotOptions, DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue, PartialWithFieldValue, SetOptions, Precondition, DocumentData, FirestoreDataConverter } from '../types';
import { map, Observable, OperatorFunction } from 'rxjs';
import { DocumentReferenceRef } from '../reference';

export interface FirestoreDocumentDeleteParams {
  precondition?: Precondition;
}

export interface FirestoreDocumentUpdateParams {
  precondition?: Precondition;
}

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
}

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
 * Creates or updates the target object using the input data.
 *
 * First checks that the data exists before writing to the datastore.
 *
 * If it does not exist, will call set without merge options in order to fully initialize the object's data.
 * If it does exist, update is done using set + merge on all defined values.
 *
 * @param data
 * @deprecated See createOrUpdateWithAccessorSet()
 */
export type CreateOrUpdateWithAccessorSetFunction<T> = (data: Partial<T>) => Promise<WriteResult | void>;

/**
 *
 * @param accessor
 * @returns
 * @deprecated Use either create or update. Behavior of this function is undesirable, and it can trip up transactions since it will perform a read.
 */
export function createOrUpdateWithAccessorSet<T>(accessor: FirestoreDocumentDataAccessor<T>): CreateOrUpdateWithAccessorSetFunction<T> {
  return (data: Partial<T>) => {
    return accessor.exists().then((exists) => {
      if (exists) {
        return updateWithAccessorSet(accessor)(data, true);
      } else {
        return accessor.set(data as WithFieldValue<T>);
      }
    });
  };
}

/**
 * Updates the target object using the input data after checking existence.
 *
 * Calls accessor's set configured for updating/merging, and filters all undefined values from the input data.
 * If it does exist, update will fail.
 *
 * @param data
 */
export type UpdateWithAccessorSetFunction<T> = (data: Partial<T>, forceUpdate?: boolean) => Promise<WriteResult | void>;

/**
 * @deprecated This does not behave well within transactions.
 *
 * @param accessor
 * @returns
 */
export function updateWithAccessorSet<T>(accessor: FirestoreDocumentDataAccessor<T>): UpdateWithAccessorSetFunction<T> {
  return async (data: Partial<T>, forceUpdate?: boolean) => {
    const exists: boolean = forceUpdate || (await accessor.exists());

    if (!exists) {
      throw new Error(`Model "${accessor.documentRef.path}" does not exist.`);
    }

    const update = filterUndefinedValues(data);
    return accessor.set(update, { merge: true });
  };
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
