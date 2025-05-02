import { Directive, OnDestroy, effect, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { ActionContextStoreSource } from '../../action.store.source';
import { ActionContextStoreSourceMap, ActionKey } from './action.map';

/**
 * Used to communicate with an dbxActionMap and set the ActionContextStore to the store based on the key.
 */
@Directive({
  selector: '[dbxActionMapSource]',
  standalone: true
})
export class DbxActionMapSourceDirective implements OnDestroy {
  private readonly _actionContextStoreSourceMap = inject(ActionContextStoreSourceMap);

  readonly source = inject(ActionContextStoreSource, { host: true });

  readonly key = input<Maybe<ActionKey>>(undefined, { alias: 'dbxActionMapSource' });
  private _currentKey: Maybe<ActionKey>;

  protected readonly _keyEffect = effect(() => {
    const nextKey = this.key();

    if (this._currentKey !== nextKey) {
      this._removeFromToStore();
    }

    this._currentKey = nextKey;
    this._addToStore();
  });

  ngOnDestroy(): void {
    this._removeFromToStore();
  }

  private _addToStore(): void {
    if (this._currentKey) {
      this._actionContextStoreSourceMap.addStoreSource(this._currentKey, this.source);
    }
  }

  private _removeFromToStore(): void {
    if (this._currentKey) {
      this._actionContextStoreSourceMap.removeStoreSource(this._currentKey);
    }
  }
}
