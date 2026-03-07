import { type Observable, combineLatest, map, type OperatorFunction, of } from 'rxjs';
import { type DocumentDataWithIdAndKey, type DocumentSnapshot } from '../types';
import { type FirestoreDocument, type FirestoreDocumentData } from './document';
import { type FirestoreDocumentSnapshotDataPair, type FirestoreDocumentSnapshotDataPairWithData, getDataFromDocumentSnapshots, documentDataWithIdAndKey } from './document.utility';
import { MAP_IDENTITY } from '@dereekb/util';

/**
 * Creates an Observable that emits arrays of document snapshots for multiple documents.
 *
 * This function streams the latest snapshots for each document in the provided array.
 * Each time any document in the array changes, a new array containing the latest snapshots
 * of all documents is emitted.
 *
 * If the input array is empty, an Observable that emits an empty array is returned.
 *
 * @template D - The FirestoreDocument implementation type
 * @param documents - Array of document instances to stream snapshots for
 * @returns Observable that emits arrays of DocumentSnapshots whenever any document changes
 */
export function latestSnapshotsFromDocuments<D extends FirestoreDocument<any>>(documents: D[]): Observable<DocumentSnapshot<FirestoreDocumentData<D>>[]> {
  return mapLatestSnapshotsFromDocuments(documents, map(MAP_IDENTITY));
}

/**
 * Creates an Observable that streams and transforms snapshots for multiple documents using `combineLatest`.
 *
 * Pipes each document's `accessor.stream()` through the provided `operator` before combining.
 * This ensures the transformation runs per-document when only one document changes, rather than
 * re-mapping all snapshots on every emission.
 *
 * {@link latestSnapshotsFromDocuments} delegates to this function with an identity operator.
 *
 * Returns `of([])` for an empty input array.
 *
 * @param documents - Documents to stream from
 * @param operator - RxJS operator applied to each document's snapshot stream individually
 * @returns Observable emitting an array of transformed values whenever any document changes
 */
export function mapLatestSnapshotsFromDocuments<D extends FirestoreDocument<any>, O>(documents: D[], operator: OperatorFunction<DocumentSnapshot<FirestoreDocumentData<D>>, O>): Observable<O[]> {
  return documents.length ? combineLatest(documents.map((x) => x.accessor.stream().pipe(operator))) : of([]);
}

/**
 * Creates an Observable that emits arrays of document data for multiple documents.
 *
 * This function streams the latest data for each document in the provided array.
 * Each time any document in the array changes, a new array containing the latest data
 * of all documents is emitted. Document data includes both the document content and
 * metadata like document ID and key.
 *
 * Non-existent documents are filtered out of the results automatically.
 *
 * @template D - The FirestoreDocument implementation type
 * @param documents - Array of document instances to stream data for
 * @returns Observable that emits arrays of document data whenever any document changes
 */
export function streamDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[]): Observable<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[]> {
  return latestSnapshotsFromDocuments<D>(documents).pipe(dataFromDocumentSnapshots());
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

// MARK: Streaming Document Snapshot Pairs
/**
 * Streams {@link FirestoreDocumentSnapshotDataPair}s for multiple documents using `combineLatest`.
 *
 * Each document's `accessor.stream()` is individually piped to produce a `{ document, snapshot, data }` triplet,
 * then all streams are combined via `combineLatest`. This ensures the mapping only runs for the document
 * that actually changed. The `data` field has `id` and `key` fields injected via {@link documentDataWithIdAndKey},
 * and will be `undefined` for documents that don't exist in Firestore.
 *
 * Returns `of([])` for an empty input array.
 *
 * This is the streaming equivalent of {@link import('./document.utility').getDocumentSnapshotDataPairs}.
 *
 * @param documents - Documents to stream snapshot-data pairs for
 * @returns Observable emitting snapshot-data pairs whenever any document changes
 */
export function streamDocumentSnapshotDataPairs<D extends FirestoreDocument<any>>(documents: D[]): Observable<FirestoreDocumentSnapshotDataPair<D>[]> {
  return documents.length
    ? combineLatest(
        documents.map((document) =>
          document.accessor.stream().pipe(
            map(
              (snapshot): FirestoreDocumentSnapshotDataPair<D> => ({
                document,
                snapshot,
                data: documentDataWithIdAndKey(snapshot) as DocumentDataWithIdAndKey<FirestoreDocumentData<D>>
              })
            )
          )
        )
      )
    : of([]);
}

/**
 * Streams {@link FirestoreDocumentSnapshotDataPairWithData}s for multiple documents, filtering out non-existent documents.
 *
 * Builds on {@link streamDocumentSnapshotDataPairs} and filters each emission to include only pairs where
 * `data` is non-nullish (i.e., the document exists in Firestore). The filtered array may be shorter than
 * the input `documents` array and may change length over time as documents are created or deleted.
 *
 * Returns `of([])` for an empty input array.
 *
 * This is the streaming equivalent of {@link import('./document.utility').getDocumentSnapshotDataPairsWithData}.
 *
 * @param documents - Documents to stream snapshot-data pairs for
 * @returns Observable emitting snapshot-data pairs for existing documents only, whenever any document changes
 */
export function streamDocumentSnapshotDataPairsWithData<D extends FirestoreDocument<any>>(documents: D[]): Observable<FirestoreDocumentSnapshotDataPairWithData<D>[]> {
  return streamDocumentSnapshotDataPairs(documents).pipe(map((pairs) => pairs.filter((pair): pair is FirestoreDocumentSnapshotDataPairWithData<D> => pair.data != null)));
}

// MARK: Compat
/**
 * @deprecated Use {@link streamDocumentSnapshotsData} instead.
 */
export const latestDataFromDocuments = streamDocumentSnapshotsData;
