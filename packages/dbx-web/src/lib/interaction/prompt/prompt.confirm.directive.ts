import { Directive, Input, effect, inject, input } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { type Maybe } from '@dereekb/util';
import { Observable, from } from 'rxjs';
import { DbxPromptConfirm, provideDbxPromptConfirm } from './prompt.confirm';
import { DbxPromptConfirmConfig } from './prompt.confirm.component';
import { DbxPromptConfirmDialogComponent } from './prompt.confirm.dialog.component';

// MARK: Abstract
/**
 * Directive that when triggered shows a dialog to accept or reject.
 */
@Directive()
export abstract class AbstractPromptConfirmDirective implements DbxPromptConfirm {
  protected readonly matDialog = inject(MatDialog);

  private _currentDialogRef?: MatDialogRef<DbxPromptConfirmDialogComponent, boolean>;
  private _currentDialogPromise?: Promise<boolean>;

  /**
   * Config used when showDialog() is called.
   */
  config?: Maybe<DbxPromptConfirmConfig>;

  showDialog(): Observable<boolean> {
    if (!this._currentDialogPromise) {
      this._currentDialogPromise = new Promise<boolean>((resolve) => {
        this._currentDialogRef = DbxPromptConfirmDialogComponent.openDialog(this.matDialog, this.config);
        this._currentDialogRef.afterClosed().subscribe((result: Maybe<boolean>) => {
          this._currentDialogRef = undefined;
          this._currentDialogPromise = undefined;
          resolve(this._handleDialogResult(Boolean(result)));
        });
      });
    }

    return from(this._currentDialogPromise);
  }

  protected _handleDialogResult(result: boolean): boolean {
    return result;
  }
}

// MARK: Directive
/**
 * Directive that shows a confirmation screen.
 */
@Directive({
  selector: '[dbxPromptConfirm]',
  providers: provideDbxPromptConfirm(DbxPromptConfirmDirective),
  standalone: true
})
export class DbxPromptConfirmDirective extends AbstractPromptConfirmDirective {
  readonly dbxPromptConfirm = input<Maybe<DbxPromptConfirmConfig>>();

  protected readonly _dbxPromptConfirmConfigEffect = effect(() => {
    this.config = this.dbxPromptConfirm();
  });
}
