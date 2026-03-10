import { Directive, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { clean, cleanSubscription } from '../../../rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { type DbxActionDisabledKey } from '../../action';
import { actionContextStoreSourceMapReader } from './action.map.utility';
import { ActionContextStoreSourceMap } from './action.map';

/**
 * Default disabled key used by {@link DbxActionMapWorkingDisableDirective} to track
 * the "another action is working" disabled reason.
 */
export const DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY = 'action_map_working_disable';

/**
 * Directive that disables the host action when any other action in the ancestor
 * {@link ActionContextStoreSourceMap} is currently working.
 *
 * This prevents concurrent action execution within a group of related actions.
 * When all other actions finish working, the host action is automatically re-enabled.
 *
 * A custom disabled key can be provided via the `dbxActionMapWorkingDisable` input.
 *
 * @example
 * ```html
 * <div dbxActionContextMap>
 *   <div dbxAction [dbxActionMapSource]="'save'" dbxActionMapWorkingDisable>
 *     <button (click)="action.trigger()">Save</button>
 *   </div>
 *   <div dbxAction [dbxActionMapSource]="'delete'" dbxActionMapWorkingDisable>
 *     <button (click)="action.trigger()">Delete</button>
 *   </div>
 * </div>
 * ```
 *
 * @see {@link DbxActionContextMapDirective} for the parent map provider.
 */
@Directive({
  selector: '[dbxActionMapWorkingDisable]',
  standalone: true
})
export class DbxActionMapWorkingDisableDirective {
  private readonly _actionContextStoreSourceMap = inject(ActionContextStoreSourceMap);

  readonly source = inject(DbxActionContextStoreSourceInstance, { host: true });

  readonly disabledKey = input<Maybe<DbxActionDisabledKey>>(undefined, { alias: 'dbxActionMapWorkingDisable' });

  readonly areAnySourcesWorking$ = actionContextStoreSourceMapReader(this._actionContextStoreSourceMap.actionKeySourceMap$).checkAny((x) => x.isWorking$, false);

  constructor() {
    cleanSubscription(
      this.areAnySourcesWorking$.subscribe((x) => {
        this.source.disable(this.disabledKey() || DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY, x);
      })
    );

    clean(() => {
      this.source.enable(this.disabledKey() || DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY);
    });
  }
}
