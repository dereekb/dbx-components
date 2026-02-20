import { first, Observable } from 'rxjs';
import { Directive, OnInit, OnDestroy, ElementRef, inject, input } from '@angular/core';
import { AbstractDbxActionValueGetterDirective } from '@dereekb/dbx-core';
import { IsEqualFunction, IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { MatDialogRef } from '@angular/material/dialog';

export type DbxActionDialogFunction<T = unknown> = () => MatDialogRef<unknown, Maybe<T>>;

/**
 * Action directive that is used to trigger/display a dialog, then watches that dialog for a value.
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
