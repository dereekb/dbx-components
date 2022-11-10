import { Directive, Host, Input, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AbstractPromptConfirmDirective } from '../interaction/prompt/prompt.confirm.directive';
import { DbxPromptConfirmConfig } from '../interaction/prompt/prompt.confirm.component';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

/**
 * DbxActionConfirmDirective configuration.
 */
export interface DbxActionConfirmConfig<T> extends DbxPromptConfirmConfig {
  /**
   * Optionally set the readyValue passed to the instance.
   */
  readyValue?: T;
}

/**
 * Directive that when triggered shows a dialog to accept or reject.
 *
 * This only works to pass a ready value or reject through, not to work with a button.
 * For button usage, use an appPromptConfirmButton directive.
 */
@Directive({
  selector: '[dbxActionConfirm]'
})
export class DbxActionConfirmDirective<T, O> extends AbstractPromptConfirmDirective implements OnInit, OnDestroy {
  @Input('dbxActionConfirm')
  override config?: Maybe<DbxActionConfirmConfig<T>>;

  private _sourceSubscription = new SubscriptionObject();

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>, dialog: MatDialog) {
    super(dialog);
  }

  ngOnInit(): void {
    this._sourceSubscription.subscription = this.source.triggered$.subscribe(() => {
      this.showDialog();
    });
  }

  ngOnDestroy(): void {
    this._sourceSubscription.destroy();
  }

  protected override _handleDialogResult(result: boolean): boolean {
    if (result) {
      this.source.readyValue(this.config?.readyValue as unknown as T);
    } else {
      this.source.reject(undefined);
    }

    return result;
  }
}
