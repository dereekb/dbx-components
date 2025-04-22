import { type Observable, combineLatest, shareReplay, map, type OperatorFunction, of } from 'rxjs';
import { type DocumentDataWithIdAndKey, type DocumentSnapshot } from '../types';
import { type FirestoreDocument, type FirestoreDocumentData } from './document';
import { getDataFromDocumentSnapshots } from './document.utility';

/**
 * Creates an Observable that emits arrays of document snapshots for multiple documents.
 *
 * This function streams the latest snapshots for each document in the provided array.
 * Each time any document in the array changes, a new array containing the latest snapshots
 * of all documents is emitted. Results are shared with multiple subscribers through shareReplay.
 *
 * If the input array is empty, an Observable that emits an empty array is returned.
 *
 * @template D - The FirestoreDocument implementation type
 * @param documents - Array of document instances to stream snapshots for
 * @returns Observable that emits arrays of DocumentSnapshots whenever any document changes
 */
export function latestSnapshotsFromDocuments<D extends FirestoreDocument<any>>(documents: D[]): Observable<DocumentSnapshot<FirestoreDocumentData<D>>[]> {
  return documents.length ? combineLatest(documents.map((x) => x.accessor.stream())).pipe(shareReplay(1)) : of([]);
}

/**
 * Creates an Observable that emits arrays of document data for multiple documents.
 *
 * This function streams the latest data for each document in the provided array.
 * Each time any document in the array changes, a new array containing the latest data
 * of all documents is emitted. Document data includes both the document content and
 * metadata like document ID and key. Results are shared with multiple subscribers.
 *
 * Non-existent documents are filtered out of the results automatically.
 *
 * @template D - The FirestoreDocument implementation type
 * @param documents - Array of document instances to stream data for
 * @returns Observable that emits arrays of document data whenever any document changes
 */
export function latestDataFromDocuments<D extends FirestoreDocument<any>>(documents: D[]): Observable<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[]> {
  return latestSnapshotsFromDocuments<D>(documents).pipe(dataFromDocumentSnapshots(), shareReplay(1));
}

/**
 * Creates an RxJS operator that transforms arrays of DocumentSnapshots into arrays of document data.
 *
 * This operator extracts the data from each document snapshot, adds ID and key information,
 * and filters out non-existent documents. It's designed to be used in a pipe after
 * operations that produce arrays of snapshots.
 *
 * @template T - The document data type
 * @returns An operator that transforms arrays of DocumentSnapshots into arrays of document data
 */
export function dataFromDocumentSnapshots<T>(): OperatorFunction<DocumentSnapshot<T>[], DocumentDataWithIdAndKey<T>[]> {
  return map((x: DocumentSnapshot<T>[]) => getDataFromDocumentSnapshots<T>(x));
}
