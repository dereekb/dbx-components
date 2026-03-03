import { Directive, OnDestroy, OnInit, inject, input } from '@angular/core';
import { AbstractPromptConfirmDirective } from '../interaction/prompt/prompt.confirm.directive';
import { DbxPromptConfirmConfig } from '../interaction/prompt/prompt.confirm.component';
import { SubscriptionObject } from '@dereekb/rxjs';
import { cleanSubscriptionWithLockSet, DbxActionContextStoreSourceInstance, transformEmptyStringInputToUndefined } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

/**
 * DbxActionConfirmDirective configuration.
 */
export interface DbxActionConfirmConfig<T = unknown> extends DbxPromptConfirmConfig {
  /**
   * Optionally set the readyValue passed to the instance.
   */
  readonly readyValue?: T;
}

/**
 * Directive that when triggered shows a dialog to accept or reject.
 *
 * This only works to pass a ready value or reject through, not to work with a button.
 * For button usage, use an appPromptConfirmButton directive.
 */
@Directive({
  selector: '[dbxActionConfirm]',
  standalone: true
})
export class DbxActionConfirmDirective<T = unknown, O = unknown> extends AbstractPromptConfirmDirective {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly dbxActionConfirm = input<Maybe<DbxActionConfirmConfig<T>>, Maybe<DbxActionConfirmConfig<T> | ''>>(undefined, { transform: transformEmptyStringInputToUndefined });

  constructor() {
    super();
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.source.triggered$.subscribe(() => {
        this.showDialog();
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
