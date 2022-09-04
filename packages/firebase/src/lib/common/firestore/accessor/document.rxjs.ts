import { Observable, combineLatest, shareReplay, map, OperatorFunction } from 'rxjs';
import { DocumentDataWithIdAndKey, DocumentSnapshot } from '../types';
import { FirestoreDocument, FirestoreDocumentData } from './document';
import { getDataFromDocumentSnapshots } from './document.utility';

export function latestSnapshotsFromDocuments<D extends FirestoreDocument<any>>(documents: D[]): Observable<DocumentSnapshot<FirestoreDocumentData<D>>[]> {
  return combineLatest(documents.map((x) => x.accessor.stream())).pipe(shareReplay(1));
}

export function latestDataFromDocuments<D extends FirestoreDocument<any>>(documents: D[]): Observable<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[]> {
  return latestSnapshotsFromDocuments<D>(documents).pipe(dataFromDocumentSnapshots(), shareReplay(1));
}

export function dataFromDocumentSnapshots<T>(): OperatorFunction<DocumentSnapshot<T>[], DocumentDataWithIdAndKey<T>[]> {
  return map((x: DocumentSnapshot<T>[]) => getDataFromDocumentSnapshots<T>(x));
}

// MARK: Compat
/**
 * @Deprecated use latestSnapshotsFromDocuments instead.
 */
export function streamDocumentSnapshots<T, D extends FirestoreDocument<T>>(documents: D[]): Observable<DocumentSnapshot<T>[]> {
  return latestSnapshotsFromDocuments(documents);
}

/**
 * @Deprecated use latestDataFromDocuments
 */
export function streamDocumentData<T, D extends FirestoreDocument<T>>(documents: D[]): Observable<DocumentDataWithIdAndKey<T>[]> {
  return latestDataFromDocuments(documents);
}
