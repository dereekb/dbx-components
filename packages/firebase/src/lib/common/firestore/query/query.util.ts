import { DocumentReference, QuerySnapshot } from './../types';
import { Observable } from "rxjs";

// MARK: OnSnapshot
export interface StreamDocsWithOnSnapshotFunctionParams<O> {
  next: (value?: O | undefined) => void,
  error: (err?: any) => void,
  complete: () => void
};

export type StreamDocsUnsubscribeFunction = () => void;

/**
 * Use to build an Observable that reacts to OnSnapshot events from queries.
 * 
 * @param callOnSnapshot 
 * @returns 
 */
export function streamFromOnSnapshot<O>(callOnSnapshot: (params: StreamDocsWithOnSnapshotFunctionParams<O>) => StreamDocsUnsubscribeFunction): Observable<O> {
  return new Observable((subscriber) => {
    const unsubscribe = callOnSnapshot({
      next: subscriber.next.bind(subscriber),
      error: subscriber.error.bind(subscriber),
      complete: subscriber.complete.bind(subscriber),
    });
    return { unsubscribe };
  });
}

export function documentReferencesFromSnapshot<T>(snapshots: QuerySnapshot<T>): DocumentReference<T>[] {
  return snapshots.docs.map(x => x.ref);
}
