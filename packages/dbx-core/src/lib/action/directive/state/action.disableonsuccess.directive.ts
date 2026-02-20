import { Directive, OnDestroy, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { combineLatest } from 'rxjs';
import { AbstractSubscriptionDirective } from '../../../rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

export const APP_ACTION_DISABLED_ON_SUCCESS_DIRECTIVE_KEY = 'dbx_action_disabled_on_success';

/**
 * Directive that will disable the action after the action completes successfully.
 */
@Directive({
  selector: '[dbxActionDisabledOnSuccess]',
  standalone: true
})
export class DbxActionDisabledOnSuccessDirective<T, O> extends AbstractSubscriptionDirective implements OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly disabledOnSuccess = input<boolean, Maybe<boolean | ''>>(true, { alias: 'dbxActionDisabledOnSuccess', transform: (value) => value !== false });
  readonly disabledOnSuccess$ = toObservable(this.disabledOnSuccess);

  constructor() {
    super();
    this.sub = combineLatest([this.disabledOnSuccess$, this.source.isSuccess$]).subscribe(([disableOnSuccess, success]) => {
      this.source.disable(APP_ACTION_DISABLED_ON_SUCCESS_DIRECTIVE_KEY, disableOnSuccess && success);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.source.enable(APP_ACTION_DISABLED_ON_SUCCESS_DIRECTIVE_KEY);
  }
}
