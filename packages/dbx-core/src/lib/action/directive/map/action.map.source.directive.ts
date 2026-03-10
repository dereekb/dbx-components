import { Directive, type OnDestroy, effect, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { ActionContextStoreSource } from '../../action.store.source';
import { ActionContextStoreSourceMap, type ActionKey } from './action.map';

/**
 * Directive that registers the host element's {@link ActionContextStoreSource} into an ancestor
 * {@link ActionContextStoreSourceMap} under the provided key.
 *
 * When the key changes, the previous registration is removed and the new one is added.
 * On destroy, the registration is cleaned up automatically.
 *
 * @example
 * ```html
 * <div dbxActionContextMap>
 *   <div dbxAction [dbxActionMapSource]="'save'">
 *     <button (click)="action.trigger()">Save</button>
 *   </div>
 * </div>
 * ```
 *
 * @see {@link DbxActionContextMapDirective} for the parent map provider.
 * @see {@link DbxActionFromMapDirective} for consuming registered actions by key.
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
