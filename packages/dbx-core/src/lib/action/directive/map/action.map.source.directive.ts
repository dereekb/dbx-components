import { Directive, Host, Input, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { ActionContextStoreSource } from '../../action.store.source';
import { DbxActionContextMapDirective } from './action.map.directive';
import { ActionKey } from './action.map';

/**
 * Used to communicate with an dbxActionMap and set the ActionContextStore to the store based on the key.
 */
@Directive({
  selector: '[dbxActionMapSource]'
})
export class DbxActionMapSourceDirective implements OnDestroy {

  private _key: Maybe<ActionKey>;

  constructor(@Host() public readonly source: ActionContextStoreSource, private readonly _map: DbxActionContextMapDirective) { }

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
