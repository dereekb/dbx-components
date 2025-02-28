import { Directive, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionContextMapDirective } from './action.map.directive';
import { DbxActionDisabledKey } from '../../action';

export const DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY = 'action_map_working_disable';

/**
 * Used to communicate with an dbxActionMap and set the ActionContextStore to be disabled if any other element in the map is working.
 */
@Directive({
  selector: '[dbxActionMapWorkingDisable]'
})
export class DbxActionMapWorkingDisableDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private readonly _map = inject(DbxActionContextMapDirective);
  readonly source = inject(DbxActionContextStoreSourceInstance, { host: true });

  @Input('dbxActionMapWorkingDisable')
  disabledKey: Maybe<DbxActionDisabledKey>;

  ngOnInit(): void {
    this.sub = this._map.areAnyWorking$.subscribe((x) => {
      this.source.disable(this.disabledKey || DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY, x);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.source.enable(this.disabledKey || DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY);
  }
}
