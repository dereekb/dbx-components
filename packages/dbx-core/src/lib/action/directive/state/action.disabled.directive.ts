import { Directive, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { clean, cleanSubscription } from '../../../rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Disabled key used by {@link DbxActionDisabledDirective} to track its disabled state.
 */
export const APP_ACTION_DISABLED_DIRECTIVE_KEY = 'dbx_action_disabled';

/**
 * Directive that disables or enables the parent action based on a boolean input.
 *
 * When `dbxActionDisabled` is `true` (or an empty string, which coerces to `true`),
 * the action is disabled with the {@link APP_ACTION_DISABLED_DIRECTIVE_KEY}. When `false`,
 * the disable key is removed, re-enabling the action (assuming no other sources have disabled it).
 *
 * The disable key is automatically cleaned up on directive destruction.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container [dbxActionDisabled]="isFormInvalid"></ng-container>
 *   <button (click)="action.trigger()">Submit</button>
 * </div>
 * ```
 *
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 *
 * @see {@link DbxActionEnforceModifiedDirective} for disabling when not modified.
 * @see {@link DbxActionDisabledOnSuccessDirective} for disabling after success.
 */
@Directive({
  selector: '[dbxActionDisabled]',
  standalone: true
})
export class DbxActionDisabledDirective<T, O> {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly disabled = input<boolean, Maybe<boolean | ''>>(false, { alias: 'dbxActionDisabled', transform: (value) => value !== false });
  readonly disabled$ = toObservable(this.disabled);

  constructor() {
    cleanSubscription(
      this.disabled$.subscribe((x) => {
        this.source.disable(APP_ACTION_DISABLED_DIRECTIVE_KEY, x);
      })
    );

    clean(() => this.source.enable(APP_ACTION_DISABLED_DIRECTIVE_KEY));
  }
}
