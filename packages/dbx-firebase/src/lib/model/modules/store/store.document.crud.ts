import { type ModelFirebaseCreateFunction, type ModelFirebaseDeleteFunction, type ModelFirebaseUpdateFunction, type OnCallCreateModelResult, type TargetModelParams, type InferredTargetModelParams, type ModelFirebaseCrudFunction, type ModelFirebaseReadFunction } from '@dereekb/firebase';
import { lazyFrom, type LoadingState, loadingStateFromObs } from '@dereekb/rxjs';
import { firstValue, type PartialOnKeys } from '@dereekb/util';
import { shareReplay, exhaustMap, first, from, type Observable } from 'rxjs';
import { type DbxFirebaseDocumentStore } from './store';

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

export type DbxFirebaseDocumentStoreCrudFunction<I, O = void> = (input: I) => Observable<LoadingState<O>>;

/**
 * Creates a DbxfirebaseDocumentStoreCrudFunction from the input ModelFirebaseCrudFunction.
 *
 * @param fn
 * @returns
 */
export function firebaseDocumentStoreCrudFunction<I, O = void>(fn: ModelFirebaseCrudFunction<I, O>): DbxFirebaseDocumentStoreCrudFunction<I, O> {
  return (params: I) => loadingStateFromObs(from(fn(params)).pipe(shareReplay(1)));
}

// MARK: Targeted Functions
/**
 * A parameter that refers to a specific key.
 */
export type DbxFirebaseDocumentStoreFunctionParams = TargetModelParams | InferredTargetModelParams;

/**
 * Used for the input to related functions
 */
export type DbxFirebaseDocumentStoreFunctionParamsInput<I extends DbxFirebaseDocumentStoreFunctionParams> = PartialOnKeys<I, 'key'>;
export type DbxFirebaseDocumentStoreFunction<I extends DbxFirebaseDocumentStoreFunctionParams, O = void> = DbxFirebaseDocumentStoreCrudFunction<DbxFirebaseDocumentStoreFunctionParamsInput<I>, O>;

// MARK: Read
/**
 * Creates a DbxfirebaseDocumentStoreCrudFunction for read.
 *
 * The store's current key is always injected into the params of the request.
 *
 * For functions that do not require the store's current key, use firebaseDocumentStoreCrudFunction() instead.
 *
 * @param store
 * @param fn
 * @returns
 */
export function firebaseDocumentStoreReadFunction<I extends DbxFirebaseDocumentStoreFunctionParams, O>(store: DbxFirebaseDocumentStore<any, any>, fn: ModelFirebaseReadFunction<I, O>): DbxFirebaseDocumentStoreFunction<I, O> {
  return firebaseDocumentStoreUpdateFunction(store, fn);
}

// MARK: Update
/**
 * Creates a DbxFirebaseDocumentStoreFunction for update.
 *
 * The store's current key is always injected into the params of the request.
 *
 * @param store
 * @param fn
 * @returns
 */
export function firebaseDocumentStoreUpdateFunction<I extends DbxFirebaseDocumentStoreFunctionParams, O = void>(store: DbxFirebaseDocumentStore<any, any>, fn: ModelFirebaseUpdateFunction<I, O>): DbxFirebaseDocumentStoreFunction<I, O> {
  return (params: DbxFirebaseDocumentStoreFunctionParamsInput<I>) =>
    loadingStateFromObs(
      store.key$.pipe(
        first(),
        exhaustMap((key) =>
          fn({
            ...params,
            key // inject key into the parameters.
          } as I)
        ),
        shareReplay(1)
      )
    );
}

// MARK: Delete
/**
 * Creates a DbxFirebaseDocumentStoreFunction for delete.
 *
 * The store's current key is always injected into the params of the request.
 *
 * @param store
 * @param fn
 * @returns
 */
export function firebaseDocumentStoreDeleteFunction<I extends DbxFirebaseDocumentStoreFunctionParams, O = void>(store: DbxFirebaseDocumentStore<any, any>, fn: ModelFirebaseDeleteFunction<I, O>): DbxFirebaseDocumentStoreFunction<I, O> {
  return (params: DbxFirebaseDocumentStoreFunctionParamsInput<I>) =>
    loadingStateFromObs(
      store.key$.pipe(
        first(),
        exhaustMap((key) =>
          fn({
            ...params,
            key // inject key into the parameters.
          } as I).then((result) => {
            store.clearRefs();
            return result;
          })
        ),
        shareReplay(1)
      )
    );
}
