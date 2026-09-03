import { Directive, inject, input, booleanAttribute } from '@angular/core';
import { AbstractPromptConfirmDirective } from '../interaction/prompt/prompt.confirm.directive';
import { type DbxPromptConfirmConfig } from '../interaction/prompt/prompt.confirm.component';
import { cleanSubscriptionWithLockSet, DbxActionContextStoreSourceInstance, transformEmptyStringInputToUndefined } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

/**
 * Configuration for the action confirmation dialog, extending the base prompt configuration
 * with an optional value to pass to the action when confirmed.
 */
export interface DbxActionConfirmConfig<T = unknown> extends DbxPromptConfirmConfig {
  /**
   * Value to pass to the action's ready state when the user confirms.
   */
  readonly readyValue?: T;
  /**
   * Whether to confirm the action immediately instead of showing the dialog.
   *
   * Useful for actions that need no confirmation but are rendered by the same template as actions that do,
   * and for passing a readyValue through without prompting.
   *
   * Defaults to false.
   */
  readonly autoConfirm?: boolean;
}

/**
 * Displays a confirmation dialog when the action is triggered. If the user confirms,
 * the configured ready value is passed to the action. If the user cancels, the action is rejected.
 *
 * A config with `autoConfirm` true shows no dialog and marks the action ready immediately. This lets a
 * template bind the same input for actions that need confirmation and actions that do not.
 *
 * This directive works with action triggering only, not button clicks.
 * For button-based confirmation, use an appPromptConfirmButton directive instead.
 *
 * @dbxWebComponent
 * @dbxWebSlug action-confirm
 * @dbxWebCategory action
 * @dbxWebRelated action-snackbar, prompt-confirm
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <div [dbxActionConfirm]="cfg"></div>
 * ```
 *
 * @example
 * ```html
 * <button [dbxAction]="deleteAction" [dbxActionConfirm]="{ header: 'Delete account?', confirmText: 'Delete' }">Delete</button>
 * ```
 */
@Directive({
  selector: '[dbxActionConfirm]'
})
export class DbxActionConfirmDirective<T = unknown, O = unknown> extends AbstractPromptConfirmDirective {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly dbxActionConfirm = input<Maybe<DbxActionConfirmConfig<T>>, Maybe<DbxActionConfirmConfig<T> | ''>>(undefined, { transform: transformEmptyStringInputToUndefined });

  /**
   * When true, the confirmation dialog is disabled and the action proceeds without prompting.
   */
  readonly dbxActionConfirmSkip = input<boolean, unknown>(false, { transform: booleanAttribute });

  constructor() {
    super();
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.source.triggered$.subscribe(() => {
        const skip = this.dbxActionConfirmSkip() || this.dbxActionConfirm()?.autoConfirm === true;

        if (skip) {
          this._handleDialogResult(true);
        } else {
          this.showDialog();
        }
      })
    });
  }

  protected getDefaultDialogConfig(): Maybe<DbxPromptConfirmConfig> {
    return this.dbxActionConfirm();
  }

  protected override _handleDialogResult(result: boolean): boolean {
    if (result) {
      this.source.readyValue(this.dbxActionConfirm()?.readyValue as unknown as T);
    } else {
      this.source.reject(undefined);
    }

    return result;
  }
}
