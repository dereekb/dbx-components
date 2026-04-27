import { Directive, inject, input } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { type Maybe } from '@dereekb/util';
import { type Observable, from } from 'rxjs';
import { type DbxPromptConfirm, provideDbxPromptConfirm } from './prompt.confirm';
import { type DbxPromptConfirmConfig } from './prompt.confirm.component';
import { DbxPromptConfirmDialogComponent } from './prompt.confirm.dialog.component';

// MARK: Abstract
/**
 * Abstract base directive that opens a confirmation dialog and resolves with the user's boolean decision.
 *
 * Subclasses provide the default dialog configuration.
 */
@Directive()
export abstract class AbstractPromptConfirmDirective implements DbxPromptConfirm {
  protected readonly matDialog = inject(MatDialog);

  private _currentDialogRef?: MatDialogRef<DbxPromptConfirmDialogComponent, boolean>;
  private _currentDialogPromise?: Promise<boolean>;

  protected abstract getDefaultDialogConfig(): Maybe<DbxPromptConfirmConfig>;

  showDialog(): Observable<boolean> {
    return this.showDialogWithConfig(this.getDefaultDialogConfig());
  }

  protected showDialogWithConfig(config: Maybe<DbxPromptConfirmConfig>): Observable<boolean> {
    this._currentDialogPromise ??= new Promise<boolean>((resolve) => {
      this._currentDialogRef = DbxPromptConfirmDialogComponent.openDialog(this.matDialog, config);
      this._currentDialogRef.afterClosed().subscribe((result: Maybe<boolean>) => {
        this._currentDialogRef = undefined;
        this._currentDialogPromise = undefined;
        resolve(this._handleDialogResult(Boolean(result)));
      });
    });

    return from(this._currentDialogPromise);
  }

  protected _handleDialogResult(result: boolean): boolean {
    return result;
  }
}

// MARK: Directive
/**
 * Directive that provides a {@link DbxPromptConfirm} implementation, opening a confirmation dialog with the given config.
 *
 * @example
 * ```html
 * <button [dbxPromptConfirm]="{ title: 'Delete?', confirmText: 'Yes' }" dbxPromptConfirmButton>Delete</button>
 * ```
 */
@Directive({
  selector: '[dbxPromptConfirm]',
  providers: provideDbxPromptConfirm(DbxPromptConfirmDirective),
  standalone: true
})
export class DbxPromptConfirmDirective extends AbstractPromptConfirmDirective {
  readonly dbxPromptConfirm = input<Maybe<DbxPromptConfirmConfig>>();

  protected override getDefaultDialogConfig(): Maybe<DbxPromptConfirmConfig> {
    return this.dbxPromptConfirm();
  }
}
