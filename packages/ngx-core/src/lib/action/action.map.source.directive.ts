import { Component, Directive, Host, Injectable, Injector, Input, OnInit, Optional, OnDestroy } from '@angular/core';
import { ProvideActionStoreSource, ActionKey, ActionContextStoreSource } from './action';
import { DbNgxActionContextMapDirective } from './action.map.directive';

/**
 * Used to communicate with an dbxActionMap and set the ActionContextStore to the store based on the key.
 */
@Directive({
  selector: '[dbxActionMapSource]'
})
export class DbNgxActionMapSourceDirective implements OnDestroy {

  private _key: ActionKey;

  constructor(@Host() public readonly source: ActionContextStoreSource, private readonly _map: DbNgxActionContextMapDirective) { }

  ngOnDestroy(): void {
    this._removeFromToStore();
  }

  @Input('dbxActionMapSource')
  set key(key: ActionKey) {
    if (this._key !== key) {
      this._removeFromToStore();
    }

    this._key = key;
    this._addToStore();
  }

  private _addToStore(): void {
    if (this._key) {
      this._map.addStoreSource(this._key, this.source);
    }
  }

  private _removeFromToStore(): void {
    if (this._key) {
      this._map.removeStore(this._key);
    }
  }

}
