import { FirestoreModelKeyRef, ModelFirebaseCreateFunction, ModelFirebaseDeleteFunction, ModelFirebaseUpdateFunction, OnCallCreateModelResult } from '@dereekb/firebase';
import { lazyFrom, LoadingState, loadingStateFromObs } from '@dereekb/rxjs';
import { firstValue } from '@dereekb/util';
import { first, Observable, switchMap } from 'rxjs';
import { Writable } from 'ts-essentials';
import { DbxFirebaseDocumentStore } from './store.document';

// MARK: Create
export type DbxFirebaseDocumentStoreCreateFunction<I, O extends OnCallCreateModelResult = OnCallCreateModelResult> = (params: I) => Observable<LoadingState<O>>;

/**
 * Creates a function for a store that DbxFirebaseDocumentStore captures the ModelFirebaseCreateFunction result and sets the key of the created value.
 *
 * @param store
 * @param fn
 * @returns
 */
export function firebaseDocumentStoreCreateFunction<I, O extends OnCallCreateModelResult = OnCallCreateModelResult>(store: DbxFirebaseDocumentStore<any, any>, fn: ModelFirebaseCreateFunction<I, O>): DbxFirebaseDocumentStoreCreateFunction<I, O> {
  return (params: I) =>
    loadingStateFromObs(
      lazyFrom(() =>
        fn(params).then((result) => {
          const modelKeys = result.modelKeys;
          const firstKey = firstValue(modelKeys);

          if (firstKey) {
            store.setKey(firstKey);
          }

          return result;
        })
      )
    );
}

// MARK: Update
export type DbxFirebaseDocumentStoreUpdateParams = Partial<Writable<FirestoreModelKeyRef>>;

export type DbxFirebaseDocumentStoreUpdateFunction<I extends DbxFirebaseDocumentStoreUpdateParams> = (params: I) => Observable<LoadingState<void>>;

export function firebaseDocumentStoreUpdateFunction<I extends DbxFirebaseDocumentStoreUpdateParams>(store: DbxFirebaseDocumentStore<any, any>, fn: ModelFirebaseUpdateFunction<I>): DbxFirebaseDocumentStoreUpdateFunction<I> {
  return (params: I) =>
    loadingStateFromObs(
      store.key$.pipe(
        first(),
        switchMap((key) =>
          fn({
            ...params,
            key // inject key into the parameters.
          })
        )
      )
    );
}

// MARK: Delete
export type DbxFirebaseDocumentStoreDeleteParams = Partial<Writable<FirestoreModelKeyRef>>;

export type DbxFirebaseDocumentStoreDeleteFunction<I extends DbxFirebaseDocumentStoreDeleteParams> = (params: I) => Observable<LoadingState<void>>;

/**
 * Deletes a function for a store that DbxFirebaseDocumentStore captures the ModelFirebaseDeleteFunction result and sets the key of the created value.
 *
 * @param store
 * @param fn
 * @returns
 */
export function firebaseDocumentStoreDeleteFunction<I>(store: DbxFirebaseDocumentStore<any, any>, fn: ModelFirebaseDeleteFunction<I>): DbxFirebaseDocumentStoreDeleteFunction<I> {
  return (params: I) =>
    loadingStateFromObs(
      store.key$.pipe(
        first(),
        switchMap((key) =>
          fn({
            ...params,
            key // inject key into the parameters.
          }).then((result) => {
            store.clearRefs();
            return result;
          })
        )
      )
    );
}
