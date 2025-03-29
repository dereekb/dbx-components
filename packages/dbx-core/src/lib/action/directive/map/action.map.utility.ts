import { asObservable, combineLatestFromMapValuesObsFn, IsCheckFunction, ObservableOrValue } from '@dereekb/rxjs';
import { map, Observable, reduce, switchMap } from 'rxjs';
import { ActionContextStore } from '../../action.store';
import { ActionContextStoreSourceMap, ActionKey } from './action.map';
import { ActionContextStoreSource } from '../../action.store.source';
import { reduceBooleansWithOrFn } from '@dereekb/util';

/**
 * Utility interface that provides a set of functions to read from an ActionContextStoreSourceMap.
 */
export interface ActionContextStoreSourceMapReader<T = unknown, O = unknown> {
  /**
   * The input key source map.
   */
  readonly actionKeySourceMap$: Observable<Map<ActionKey, ActionContextStoreSource<T, O>>>;

  /**
   * Checks if any of the stores in the map match the input checkFunction.
   *
   * @param checkFunction Function to apply to each store.
   * @param emptyArrayValue Value to return if the map is empty.
   */
  checkAny(checkFunction: IsCheckFunction<ActionContextStore<T, O>>, emptyArrayValue?: boolean): Observable<boolean>;

  /**
   * Reduces a value from all stores in the map.
   *
   * @param mapFn Function to apply to each store.
   * @param reduceFn Function to apply to the results of the mapFn.
   */
  reduceFromAllSources<X, Y>(mapFn: (input: ActionContextStore<T, O>) => Observable<X>, reduceFn: (values: X[]) => Y): Observable<Y>;

  /**
   * Reads a value from each store in the map and returns an array of the results.
   *
   * @param mapFn Function to apply to each store.
   */
  fromAllSources<Y>(mapFn: (input: ActionContextStore<T, O>) => Observable<Y>): Observable<Y[]>;
}

/**
 * Creates a new ActionContextStoreSourceMapReader from the input.
 
 * @param actionKeySourceMap$ 
 */
export function actionContextStoreSourceMapReader<T = unknown, O = unknown>(actionKeySourceMap$: ObservableOrValue<Map<ActionKey, ActionContextStoreSource<T, O>>>): ActionContextStoreSourceMapReader<T, O> {
  const sourceMap$ = asObservable(actionKeySourceMap$);

  function checkAnyAre(mapFn: (input: ActionContextStore<T, O>) => Observable<boolean>, emptyArrayValue?: boolean): Observable<boolean> {
    return reduceFromAllSources(mapFn, reduceBooleansWithOrFn(emptyArrayValue));
  }

  function reduceFromAllSources<X, Y>(mapFn: (input: ActionContextStore<T, O>) => Observable<X>, reduceFn: (values: X[]) => Y): Observable<Y> {
    return fromAllSources<X>(mapFn).pipe(map(reduceFn));
  }

  function fromAllSources<Y>(mapFn: (input: ActionContextStore<T, O>) => Observable<Y>): Observable<Y[]> {
    return sourceMap$.pipe(switchMap(combineLatestFromMapValuesObsFn((x) => x.store$.pipe(switchMap(mapFn)))));
  }

  return {
    actionKeySourceMap$: sourceMap$,
    fromAllSources,
    checkAny: checkAnyAre,
    reduceFromAllSources
  };
}

/**
 * Returns an Observable of the results of the mapFn for each source in the actionKeySourceMap$.
 *
 * @param actionKeySourceMap$ Observable of the action key source map.
 * @param mapFn Function to apply to each source.
 * @returns Observable of the results of the mapFn for each source.
 */
export function fromAllActionContextStoreSourceMapSources<O>(actionKeySourceMap$: ObservableOrValue<ActionContextStoreSourceMap>, mapFn: (input: ActionContextStore) => Observable<O>): Observable<O[]> {
  return asObservable(actionKeySourceMap$).pipe(
    switchMap((x) => x.actionKeySourceMap$),
    switchMap(combineLatestFromMapValuesObsFn((x) => x.store$.pipe(switchMap(mapFn))))
  );
}
