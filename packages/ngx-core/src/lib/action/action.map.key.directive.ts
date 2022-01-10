import { Component, Directive, Injectable, Injector, Input, OnDestroy, OnInit, Optional } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ProvideSecondaryActionStoreSource, ActionKey, SecondaryActionContextStoreSource } from './action';
import { DbNgxActionContextMapDirective } from './action.map.directive';

/**
 * Directive that provides a ActionContextStoreSource using the input key and DbNgxActionContextMapDirective.
 */
@Directive({
  selector: '[dbxActionFromMap]',
  providers: ProvideSecondaryActionStoreSource(DbNgxActionFromMapDirective)
})
export class DbNgxActionFromMapDirective implements SecondaryActionContextStoreSource, OnDestroy {

  private _key = new BehaviorSubject<ActionKey>(undefined);
  readonly store$ = this._key.pipe(switchMap((x) => this._map.sourceForKey(x).store$));

  constructor(private readonly _map: DbNgxActionContextMapDirective) { }

  ngOnDestroy(): void {
    this._key.complete();
  }

  @Input('dbxActionFromMap')
  get key(): ActionKey {
    return this._key.value;
  }

  set key(key: ActionKey) {
    this._key.next(key);
  }

}
