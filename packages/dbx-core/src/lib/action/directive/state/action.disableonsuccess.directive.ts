import { Directive, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { combineLatest } from 'rxjs';
import { clean, cleanSubscription } from '../../../rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Disabled key used by {@link DbxActionDisabledOnSuccessDirective} to track the
 * "disabled after success" reason.
 */
export const APP_ACTION_DISABLED_ON_SUCCESS_DIRECTIVE_KEY = 'dbx_action_disabled_on_success';

/**
 * Directive that disables the parent action after it resolves successfully.
 *
 * This is useful for one-shot actions where the user should not be able to re-trigger
 * the action after it succeeds (e.g., a confirmation dialog or a single-use form submission).
 *
 * Can be disabled by setting `dbxActionDisabledOnSuccess` to `false`.
 *
 * The disable key is automatically cleaned up on directive destruction.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container dbxActionDisabledOnSuccess></ng-container>
 *   <button (click)="action.trigger()">Confirm</button>
 * </div>
 * ```
 *
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 *
 * @see {@link DbxActionDisabledDirective} for general-purpose disabling.
 * @see {@link DbxActionEnforceModifiedDirective} for disabling when not modified.
 */
@Directive({
  selector: '[dbxActionDisabledOnSuccess]',
  standalone: true
})
export class DbxActionDisabledOnSuccessDirective<T, O> {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly disabledOnSuccess = input<boolean, Maybe<boolean | ''>>(true, { alias: 'dbxActionDisabledOnSuccess', transform: (value) => value !== false });
  readonly disabledOnSuccess$ = toObservable(this.disabledOnSuccess);

  constructor() {
    cleanSubscription(
      combineLatest([this.disabledOnSuccess$, this.source.isSuccess$]).subscribe(([disableOnSuccess, success]) => {
        this.source.disable(APP_ACTION_DISABLED_ON_SUCCESS_DIRECTIVE_KEY, disableOnSuccess && success);
      })
    );

    clean(() => this.source.enable(APP_ACTION_DISABLED_ON_SUCCESS_DIRECTIVE_KEY));
  }
}
