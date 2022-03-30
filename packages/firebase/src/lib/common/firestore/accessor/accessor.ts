import { filterMaybe } from '@dereekb/rxjs';
import { Maybe } from "@dereekb/util";
import { SnapshotOptions, DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue } from "../types";
import { map, Observable, OperatorFunction } from 'rxjs';
import { FirestoreDocumentReference } from '../reference';

/**
 * Firestore database accessor instance used to retrieve and make changes to items in the database.
 */
export interface FirestoreDocumentDataAccessor<T> extends FirestoreDocumentReference<T> {
  /**
   * Returns a database stream of DocumentSnapshots.
   */
  stream(): Observable<DocumentSnapshot<T>>;
  /**
   * Returns the current snapshot.
   */
  get(): Promise<DocumentSnapshot<T>>;
  /**
   * Deletes the document
   */
  delete(): Promise<any | void>;
  /**
   * Sets the data in the database.
   * 
   * @param data 
   */
  set(data: WithFieldValue<T>): Promise<void>;
  /**
   * Updates the data in the database.
   * 
   * @param data 
   */
  update(data: UpdateData<T>): Promise<void>;
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
