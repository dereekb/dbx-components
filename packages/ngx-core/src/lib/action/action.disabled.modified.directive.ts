import { Directive, Host, Input, OnInit, OnDestroy } from '@angular/core';
import { AbstractSubscriptionDirective } from '../subscription';
import { ActionContextStoreSourceInstance } from './action';

export const APP_ACTION_DISABLED_UNTIL_MODIFIED_DIRECTIVE_KEY = 'app_action_is_not_modified';

/**
 * Directive that sets the disabled state based on the current isModified state.
 */
@Directive({
  selector: '[dbxActionDisabledUntilModified]'
})
export class DbNgxActionDisabledUntilModifiedDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance<T, O>) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.isModified$.subscribe((x) => {
      this.source.disable(APP_ACTION_DISABLED_UNTIL_MODIFIED_DIRECTIVE_KEY, !x);
    });
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.source.enable(APP_ACTION_DISABLED_UNTIL_MODIFIED_DIRECTIVE_KEY);
  }

}
