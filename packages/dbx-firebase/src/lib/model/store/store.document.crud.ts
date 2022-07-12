import { ModelFirebaseCreateFunction, ModelFirebaseDeleteFunction, ModelFirebaseUpdateFunction, OnCallCreateModelResult, TargetModelParams, InferredTargetModelParams } from '@dereekb/firebase';
import { lazyFrom, LoadingState, loadingStateFromObs } from '@dereekb/rxjs';
import { firstValue, PartialOnKeys } from '@dereekb/util';
import { first, Observable, switchMap } from 'rxjs';
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

// MARK: Targeted Functions
/**
 * A parameter that refers to a specific key.
 */
export type DbxFirebaseDocumentStoreFunctionParams = TargetModelParams | InferredTargetModelParams;

/**
 * Used for the input to related functions
 */
export type DbxFirebaseDocumentStoreFunctionParamsInput<I extends DbxFirebaseDocumentStoreFunctionParams> = PartialOnKeys<I, 'key'>;
export type DbxFirebaseDocumentStoreFunction<I extends DbxFirebaseDocumentStoreFunctionParams, O = void> = (params: DbxFirebaseDocumentStoreFunctionParamsInput<I>) => Observable<LoadingState<O>>;

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
        switchMap((key) =>
          fn({
            ...params,
            key // inject key into the parameters.
          } as I)
        )
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
        switchMap((key) =>
          fn({
            ...params,
            key // inject key into the parameters.
          } as I).then((result) => {
            store.clearRefs();
            return result;
          })
        )
      )
    );
}
