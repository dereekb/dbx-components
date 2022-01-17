import { reduceBooleansWithOrFn } from '@dereekb/util';
import { Directive, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, switchMap } from 'rxjs/operators';
import { combineLatestFromMapValuesObsFn } from '@dereekb/util-rxjs';
import { ActionContextStoreSource, ActionContextStoreSourceMap, actionContextStoreSourcePipe, ActionKey } from './action';
import { ActionContextStore } from './action.store';

/**
 * Context used for providing actions based on the action key.
 *
 * This is useful for passing action contexts around via the providers instead of explicit injection.
 */
@Directive({
  selector: '[dbxActionContextMap]',
  exportAs: 'actionMap',
  providers: [],
})
export class DbNgxActionContextMapDirective implements ActionContextStoreSourceMap, OnDestroy {

  private readonly _map = new BehaviorSubject<Map<ActionKey, ActionContextStoreSource>>(new Map());
  readonly map$ = this._map.asObservable();

  readonly areAnyWorking$ = this.checkAnyAre(x => x.isWorking$, false);

  constructor() { }

  get map(): Map<ActionKey, ActionContextStoreSource> {
    return this._map.value;
  }

  sourceForKey(key: ActionKey): ActionContextStoreSource<any, any> {
    return new DbNgxActionContextMapDirectiveSourceInstance(this, key);
  }

  addStoreSource(key: ActionKey, source: ActionContextStoreSource): void {
    if (this.map.has(key)) {
      throw new Error(`Key already existed for "${key}" in map. Ensure the previous store is removed before setting another.`);
    } else if (!source) {
      throw new Error('addStoreSource requires a source.');
    }

    this.map.set(key, source);
    this._map.next(this.map);
  }

  removeStore(key: ActionKey): void {
    if (!this.map.delete(key)) {
      console.warn('removeStore called and no value was found.');
    }

    this._map.next(this.map);
  }

  ngOnDestroy(): void {
    this._map.complete();
  }

  // MARK: Utility
  checkAnyAre(mapFn: (input: ActionContextStore) => Observable<boolean>, emptyArrayValue = false): Observable<boolean> {
    return this.reduceFromAllSources(mapFn, reduceBooleansWithOrFn(emptyArrayValue));
  }

  reduceFromAllSources<O, R>(mapFn: (input: ActionContextStore) => Observable<O>, reduceFn: (values: O[]) => R): Observable<R> {
    return this.fromAllSources<O>(mapFn).pipe(map(reduceFn));
  }

  fromAllSources<O>(mapFn: (input: ActionContextStore) => Observable<O>): Observable<O[]> {
    return this.map$.pipe(switchMap(combineLatestFromMapValuesObsFn((x) => x.store$.pipe(switchMap(mapFn)))));
  }

}

export class DbNgxActionContextMapDirectiveSourceInstance implements ActionContextStoreSource {

  readonly _source$ = this.parent.map$.pipe(map(x => x.get(this.key)), distinctUntilChanged());
  readonly _store$ = this._source$.pipe(switchMap((x) => x?.store$ ?? of(undefined)), shareReplay(1));
  readonly store$ = actionContextStoreSourcePipe(this._store$);

  constructor(private readonly parent: DbNgxActionContextMapDirective, readonly key: ActionKey) { }

}
