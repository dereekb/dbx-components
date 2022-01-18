import { Directive, Host, Input, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, from } from 'rxjs';
import { DbNgxPromptConfirm, ProvideDbNgxPromptConfirm } from './prompt.confirm';
import { DbNgxPromptConfirmConfig, DbNgxPromptConfirmTypes } from './prompt.confirm.component';
import { DbNgxPromptConfirmDialogComponent } from './prompt.confirm.dialog.component';

// MARK: Abstract
/**
 * Directive that when triggered shows a dialog to accept or reject.
 */
@Directive()
export abstract class AbstractPromptConfirmDirective implements DbNgxPromptConfirm {

  private static readonly DEFAULT_CONFIG = {
    title: 'Confirm?',
    type: DbNgxPromptConfirmTypes.NORMAL
  };

  config?: DbNgxPromptConfirmConfig;

  private _dialogRef: MatDialogRef<DbNgxPromptConfirmDialogComponent, boolean>;
  private _dialogPromise: Promise<boolean>;

  constructor(protected readonly dialog: MatDialog) { }

  showDialog(): Observable<boolean> {
    if (!this._dialogPromise) {
      this._dialogPromise = new Promise((resolve) => {
        this._dialogRef = this._makeDialog();
        this._dialogRef.afterClosed().subscribe((result: boolean) => {
          this._dialogRef = undefined;
          this._dialogPromise = undefined;
          resolve(this._handleDialogResult(result));
        });
      });
    }

    return from(this._dialogPromise);
  }

  protected _makeDialog(): MatDialogRef<DbNgxPromptConfirmDialogComponent, boolean> {
    const dialogRef = this.dialog.open(DbNgxPromptConfirmDialogComponent);
    dialogRef.componentInstance.config = this.config ?? AbstractPromptConfirmDirective.DEFAULT_CONFIG;
    return dialogRef;
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
  providers: ProvideDbNgxPromptConfirm(DbNgxPromptConfirmDirective)
})
export class DbNgxPromptConfirmDirective<T, O> extends AbstractPromptConfirmDirective {

  @Input('dbxPromptConfirm')
  config?: DbNgxPromptConfirmConfig;

  constructor(dialog: MatDialog) {
    super(dialog);
  }

}
