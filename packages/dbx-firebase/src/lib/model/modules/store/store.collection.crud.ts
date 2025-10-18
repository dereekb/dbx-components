import { type ModelFirebaseCreateFunction, type ModelFirebaseCrudFunction, type OnCallCreateModelResult } from '@dereekb/firebase';
import { type LoadingState, loadingStateFromObs, lazyFrom } from '@dereekb/rxjs';
import { asArray } from '@dereekb/util';
import { type Observable, from, shareReplay } from 'rxjs';
import { type DbxFirebaseCollectionStore } from './store.collection';

// MARK: Create
export type DbxFirebaseCollectionStoreCreateFunction<I, O extends OnCallCreateModelResult = OnCallCreateModelResult> = (params: I) => Observable<LoadingState<O>>;

/**
 * Creates a function for a store that DbxFirebaseDocumentStore captures the ModelFirebaseCreateFunction result and sets the key of the created value.
 *
 * @param store
 * @param fn
 * @returns
 */
export function firebaseCollectionStoreCreateFunction<I, O extends OnCallCreateModelResult = OnCallCreateModelResult>(store: DbxFirebaseCollectionStore<any, any>, fn: ModelFirebaseCreateFunction<I, O>): DbxFirebaseCollectionStoreCreateFunction<I, O> {
  return (params: I) =>
    loadingStateFromObs(
      lazyFrom(() =>
        fn(params).then((result) => {
          const modelKeys = asArray(result.modelKeys);

          store.setCollectionKeys(modelKeys);
          store.setCollectionMode('references'); // switch mode to references if not yet set

          return result;
        })
      )
    );
}

export type DbxFirebaseCollectionStoreCrudFunction<I, O = void> = (input: I) => Observable<LoadingState<O>>;

/**
 * Creates a DbxfirebaseDocumentStoreCrudFunction from the input ModelFirebaseCrudFunction.
 *
 * @param fn
 * @returns
 */
export function firebaseCollectionStoreCrudFunction<I, O = void>(fn: ModelFirebaseCrudFunction<I, O>): DbxFirebaseCollectionStoreCrudFunction<I, O> {
  return (params: I) => loadingStateFromObs(from(fn(params)).pipe(shareReplay(1)));
}
