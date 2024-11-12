import { Directive, Input, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Maybe } from '@dereekb/util';
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

  private _dialogRef?: MatDialogRef<DbxPromptConfirmDialogComponent, boolean>;
  private _dialogPromise?: Promise<boolean>;

  abstract config?: Maybe<DbxPromptConfirmConfig>;

  showDialog(): Observable<boolean> {
    if (!this._dialogPromise) {
      this._dialogPromise = new Promise<boolean>((resolve) => {
        this._dialogRef = DbxPromptConfirmDialogComponent.openDialog(this.matDialog, this.config);
        this._dialogRef.afterClosed().subscribe((result: Maybe<boolean>) => {
          this._dialogRef = undefined;
          this._dialogPromise = undefined;
          resolve(this._handleDialogResult(Boolean(result)));
        });
      });
    }

    return from(this._dialogPromise);
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
  providers: provideDbxPromptConfirm(DbxPromptConfirmDirective)
})
export class DbxPromptConfirmDirective extends AbstractPromptConfirmDirective {
  @Input('dbxPromptConfirm')
  override config?: Maybe<DbxPromptConfirmConfig>;
}
