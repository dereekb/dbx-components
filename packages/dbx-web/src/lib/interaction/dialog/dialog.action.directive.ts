import { first, type Observable } from 'rxjs';
import { Directive, ElementRef, inject, input } from '@angular/core';
import { AbstractDbxActionValueGetterDirective } from '@dereekb/dbx-core';
import { type IsEqualFunction, type IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type MatDialogRef } from '@angular/material/dialog';

/**
 * A function that opens a MatDialog and returns the dialog reference. Used with {@link DbxActionDialogDirective}.
 */
export type DbxActionDialogFunction<T = unknown> = () => MatDialogRef<unknown, Maybe<T>>;

/**
 * Action directive that opens a dialog and captures the returned value as the action's value.
 *
 * The directive triggers the provided dialog function, waits for the dialog to close, and uses the result as the action value.
 *
 * @example
 * ```html
 * <button [dbxActionDialog]="openMyDialog" dbxActionButton></button>
 * ```
 */
@Directive({
  exportAs: 'dbxActionDialog',
  selector: '[dbxActionDialog]',
  standalone: true
})
export class DbxActionDialogDirective<T = unknown> extends AbstractDbxActionValueGetterDirective<T> {
  readonly elementRef = inject(ElementRef);

  readonly dbxActionDialog = input.required<DbxActionDialogFunction<T>>();
  readonly dbxActionDialogIsModified = input<Maybe<IsModifiedFunction>>();
  readonly dbxActionDialogIsEqual = input<Maybe<IsEqualFunction>>();

  constructor() {
    super();
    this.configureInputs({
      isModifiedSignal: this.dbxActionDialogIsModified,
      isEqualSignal: this.dbxActionDialogIsEqual
    });
    this.setValueGetterFunction(() => this._getDataFromDialog());
  }

  protected _getDataFromDialog(): Observable<Maybe<T>> {
    return this._makeDialogRef().afterClosed().pipe(first());
  }

  protected _makeDialogRef(): MatDialogRef<unknown, Maybe<T>> {
    return this.dbxActionDialog()();
  }
}
