import { Directive, OnInit, OnDestroy, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { type DbxActionDisabledKey } from '../../action';
import { actionContextStoreSourceMapReader } from './action.map.utility';
import { ActionContextStoreSourceMap } from './action.map';

export const DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY = 'action_map_working_disable';

/**
 * Used to communicate with an dbxActionMap and set the ActionContextStore to be disabled if any other element in the map is working.
 */
@Directive({
  selector: '[dbxActionMapWorkingDisable]',
  standalone: true
})
export class DbxActionMapWorkingDisableDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private readonly _actionContextStoreSourceMap = inject(ActionContextStoreSourceMap);
  readonly source = inject(DbxActionContextStoreSourceInstance, { host: true });

  readonly disabledKey = input<Maybe<DbxActionDisabledKey>>(undefined, { alias: 'dbxActionMapWorkingDisable' });

  readonly areAnySourcesWorking$ = actionContextStoreSourceMapReader(this._actionContextStoreSourceMap.actionKeySourceMap$).checkAny((x) => x.isWorking$, false);

  ngOnInit(): void {
    this.sub = this.areAnySourcesWorking$.subscribe((x) => {
      this.source.disable(this.disabledKey() || DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY, x);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.source.enable(this.disabledKey() || DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY);
  }
}
