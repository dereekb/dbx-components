import { filterMaybe } from '@dereekb/rxjs';
import { Maybe } from "@dereekb/util";
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
   * Whether or not the target object exists.
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
  set(data: WithFieldValue<T>): Promise<WriteResult | void>;
  set(data: PartialWithFieldValue<T>, options: SetOptions): Promise<WriteResult | void>;
  /**
   * Updates the data in the database. If the document doesn't exist, it will fail.
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
