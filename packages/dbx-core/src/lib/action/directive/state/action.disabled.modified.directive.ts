import { Directive, Host, OnInit, OnDestroy } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

export const APP_ACTION_DISABLED_UNTIL_MODIFIED_DIRECTIVE_KEY = 'dbx_action_is_not_modified';

/**
 * Directive that sets the disabled state based on the current isModified state.
 */
@Directive({
  selector: '[dbxActionDisabledUntilModified]'
})
export class DbxActionDisabledUntilModifiedDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.isModified$.subscribe((x) => {
      this.source.disable(APP_ACTION_DISABLED_UNTIL_MODIFIED_DIRECTIVE_KEY, !x);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.source.enable(APP_ACTION_DISABLED_UNTIL_MODIFIED_DIRECTIVE_KEY);
  }

}
