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
}

/**
 * Displays a confirmation dialog when the action is triggered. If the user confirms,
 * the configured ready value is passed to the action. If the user cancels, the action is rejected.
 *
 * This directive works with action triggering only, not button clicks.
 * For button-based confirmation, use an appPromptConfirmButton directive instead.
 *
 * @example
 * ```html
 * <form [dbxAction]="myAction" [dbxActionConfirm]="{ title: 'Confirm Delete', prompt: 'Are you sure?', readyValue: itemId }">
 *   ...
 * </form>
 * ```
 */
@Directive({
  selector: '[dbxActionConfirm]',
  standalone: true
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
        const skip = this.dbxActionConfirmSkip();

        if (!skip) {
          this.showDialog();
        } else {
          this._handleDialogResult(true);
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
