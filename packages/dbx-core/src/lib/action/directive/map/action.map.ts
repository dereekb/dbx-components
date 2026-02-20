import { BehaviorSubject, distinctUntilChanged, map, type Observable, of, shareReplay, switchMap } from 'rxjs';
import { type ActionContextStoreSource, actionContextStoreSourcePipe } from '../../action.store.source';
import { type Destroyable } from '@dereekb/util';
import { OnDestroy } from '@angular/core';

/**
 * Arbitrary string used to identify an action.
 */
export type ActionKey = string;

/**
 * Map that returns sources for ActionKey values.
 */
export abstract class ActionContextStoreSourceMap<T = unknown, O = unknown> implements Destroyable {
  /**
   * Returns the read-only map of action keys to sources.
   */
  abstract readonly actionKeySourceMap$: Observable<Map<ActionKey, ActionContextStoreSource<T, O>>>;
  /**
   * Returns a ActionContextStoreSource for the input action key.
   *
   * @param key Action key to retrieve the source for.
   */
  abstract sourceForKey(key: ActionKey): ActionContextStoreSource<T, O>;
  /**
   * Adds the store source for the input key.
   * @param key Action key to add the source for.
   * @param source Store source to add.
   */
  abstract addStoreSource(key: ActionKey, source: ActionContextStoreSource<T, O>): void;
  /**
   * Removes the store source for the input key.
   * @param key Action key to remove the source for.
   */
  abstract removeStoreSource(key: ActionKey): void;
  /**
   * Destroys the map.
   */
  abstract destroy(): void;
}

/**
 * Creates a new ActionContextStoreSourceMap.
 *
 * @returns A new ActionContextStoreSourceMap.
 */
export function actionContextStoreSourceMap<T = unknown, O = unknown>(): ActionContextStoreSourceMap<T, O> {
  const _actionKeySourceMap = new BehaviorSubject<Map<ActionKey, ActionContextStoreSource<T, O>>>(new Map());
  const actionKeySourceMap$ = _actionKeySourceMap.asObservable();

  function updateMap(fn: (map: Map<ActionKey, ActionContextStoreSource<T, O>>) => Map<ActionKey, ActionContextStoreSource<T, O>> | void): void {
    const currentMap = _actionKeySourceMap.value;
    const nextMap = fn(currentMap) ?? currentMap;
    _actionKeySourceMap.next(nextMap);
  }

  function sourceForKey(key: ActionKey): ActionContextStoreSource<T, O> {
    const _store$ = actionKeySourceMap$.pipe(
      map((x) => x.get(key)),
      distinctUntilChanged(),
      switchMap((x) => x?.store$ ?? of(undefined)),
      shareReplay(1)
    );

    const source: ActionContextStoreSource<T, O> = {
      store$: actionContextStoreSourcePipe(_store$)
    };

    return source;
  }

  function addStoreSource(key: ActionKey, source: ActionContextStoreSource<T, O>): void {
    updateMap((actionKeySourceMap) => {
      if (actionKeySourceMap.has(key)) {
        throw new Error(`Key already existed for "${key}" in map. Ensure the previous store is removed before setting another.`);
      } else if (!source) {
        throw new Error('addStoreSource requires a source.');
      }

      actionKeySourceMap.set(key, source);
      return actionKeySourceMap;
    });
  }

  function removeStoreSource(key: ActionKey): void {
    updateMap((actionKeySourceMap) => {
      if (!actionKeySourceMap.delete(key)) {
        console.warn('removeStore called and no value was found.');
      }

      return actionKeySourceMap;
    });
  }

  function destroy(): void {
    _actionKeySourceMap.complete();
  }

  const result: ActionContextStoreSourceMap<T, O> = {
    actionKeySourceMap$: actionKeySourceMap$,
    sourceForKey: sourceForKey,
    addStoreSource: addStoreSource,
    removeStoreSource: removeStoreSource,
    destroy
  };

  return result;
}
