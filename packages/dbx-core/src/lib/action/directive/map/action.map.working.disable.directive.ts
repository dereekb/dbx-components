import { Directive, Host, Input, OnInit, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { ActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionContextMapDirective } from './action.map.directive';
import { ActionDisabledKey } from '../../action';

export const DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY = '__disabled';

/**
 * Used to communicate with an dbxActionMap and set the ActionContextStore to be disabled if any other element in the map is working.
 */
@Directive({
  selector: '[dbxActionMapWorkingDisable]'
})
export class DbxActionMapWorkingDisableDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  @Input('dbxActionMapWorkingDisable')
  disabledKey: Maybe<ActionDisabledKey>;

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance, private readonly _map: DbxActionContextMapDirective) {
    super();
  }

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
