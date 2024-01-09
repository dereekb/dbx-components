import { Observable, combineLatest, shareReplay, map, OperatorFunction, of } from 'rxjs';
import { DocumentDataWithIdAndKey, DocumentSnapshot } from '../types';
import { FirestoreDocument, FirestoreDocumentData } from './document';
import { getDataFromDocumentSnapshots } from './document.utility';

export function latestSnapshotsFromDocuments<D extends FirestoreDocument<any>>(documents: D[]): Observable<DocumentSnapshot<FirestoreDocumentData<D>>[]> {
  return documents.length ? combineLatest(documents.map((x) => x.accessor.stream())).pipe(shareReplay(1)) : of([]);
}

export function latestDataFromDocuments<D extends FirestoreDocument<any>>(documents: D[]): Observable<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[]> {
  return latestSnapshotsFromDocuments<D>(documents).pipe(dataFromDocumentSnapshots(), shareReplay(1));
}

export function dataFromDocumentSnapshots<T>(): OperatorFunction<DocumentSnapshot<T>[], DocumentDataWithIdAndKey<T>[]> {
  return map((x: DocumentSnapshot<T>[]) => getDataFromDocumentSnapshots<T>(x));
}
