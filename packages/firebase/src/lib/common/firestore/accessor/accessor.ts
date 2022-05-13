import { filterMaybe } from '@dereekb/rxjs';
import { filterUndefinedValues, Maybe } from "@dereekb/util";
import { WriteResult, SnapshotOptions, DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue, PartialWithFieldValue, SetOptions, Precondition } from "../types";
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
export interface FirestoreDocumentDataAccessor<T> extends DocumentReferenceRef<T> {
  /**
   * Returns a database stream of DocumentSnapshots.
   */
  stream(): Observable<DocumentSnapshot<T>>;
  /**
   * Returns the current snapshot.
   */
  get(): Promise<DocumentSnapshot<T>>;
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
   * Directly updates the data in the database. If the document doesn't exist, it will fail.
   * 
   * NOTE: Update will skip any conversions and directly set the data.
   * If you rely on the converter/conversion functionality, use set() with merge: true instead of update.
   * 
   * @param data 
   */
  update(data: UpdateData<T>, params?: FirestoreDocumentUpdateParams): Promise<WriteResult | void>;
}

/**
 * Contextual interface used for making a FirestoreDocumentModifier for a specific document.
 */
export interface FirestoreDocumentDataAccessorFactory<T> {

  /**
   * Creates a new FirestoreDocumentDataAccessor for the input ref.
   * 
   * @param ref
   */
  accessorFor(ref: DocumentReference<T>): FirestoreDocumentDataAccessor<T>;

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
 */
export type CreateOrUpdateWithAccessorSetFunction<T> = (data: Partial<T>) => Promise<WriteResult | void>;

export function createOrUpdateWithAccessorSet<T>(accessor: FirestoreDocumentDataAccessor<T>): (data: Partial<T>) => Promise<WriteResult | void> {
  return (data: Partial<T>) => {
    return accessor.exists().then((exists) => {
      if (exists) {
        const update = filterUndefinedValues(data);
        return accessor.set(update, { merge: true });
      } else {
        return accessor.set(data as WithFieldValue<T>);
      }
    });
  };
}
