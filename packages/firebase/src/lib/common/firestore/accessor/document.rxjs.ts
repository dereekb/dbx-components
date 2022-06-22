import { Observable, combineLatest, shareReplay, map, OperatorFunction } from 'rxjs';
import { DocumentDataWithId, DocumentSnapshot } from '../types';
import { FirestoreDocument } from './document';
import { getDataFromDocumentSnapshots } from './document.utility';

export function streamDocumentSnapshots<T, D extends FirestoreDocument<T>>(documents: D[]): Observable<DocumentSnapshot<T>[]> {
  return combineLatest(documents.map((x) => x.accessor.stream())).pipe(shareReplay(1));
}

export function streamDocumentData<T, D extends FirestoreDocument<T>>(documents: D[]): Observable<DocumentDataWithId<T>[]> {
  return streamDocumentSnapshots<T, D>(documents).pipe(dataFromDocumentSnapshots(), shareReplay(1));
}

export function dataFromDocumentSnapshots<T>(): OperatorFunction<DocumentSnapshot<T>[], DocumentDataWithId<T>[]> {
  return map((x: DocumentSnapshot<T>[]) => getDataFromDocumentSnapshots<T>(x));
}
