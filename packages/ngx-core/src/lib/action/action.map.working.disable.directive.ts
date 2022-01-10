import { Component, Directive, Host, Injectable, Injector, Input, OnInit, Optional, OnDestroy } from '@angular/core';
import { AbstractSubscriptionDirective } from '../subscription';
import { ActionContextStoreSourceInstance } from './action';
import { DbNgxActionContextMapDirective } from './action.map.directive';
import { ActionDisabledKey } from './action.store';

export const DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY = '';

/**
 * Used to communicate with an dbxActionMap and set the ActionContextStore to be disabled if any other element in the map is working.
 */
@Directive({
  selector: '[dbxActionMapWorkingDisable]'
})
export class DbNgxActionMapWorkingDisableDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  @Input('dbxActionMapWorkingDisable')
  disabledKey: ActionDisabledKey;

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance, private readonly _map: DbNgxActionContextMapDirective) {
    super();
  }

  ngOnInit(): void {
    this.sub = this._map.areAnyWorking$.subscribe((x) => {
      this.source.disable(this.disabledKey || DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY, x);
    });
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.source.enable(this.disabledKey || DEFAULT_ACTION_MAP_WORKING_DISABLED_KEY);
  }

}
