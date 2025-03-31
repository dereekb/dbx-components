import { first, Observable } from 'rxjs';
import { Directive, OnInit, OnDestroy, Input, ElementRef, inject, input } from '@angular/core';
import { AbstractDbxActionValueOnTriggerDirective } from '@dereekb/dbx-core';
import { IsEqualFunction, IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { MatDialogRef } from '@angular/material/dialog';

export type DbxActionDialogFunction<T = unknown> = () => MatDialogRef<unknown, Maybe<T>>;

/**
 * Action directive that is used to trigger/display a dialog, then watches that dialog for a value.
 */
@Directive({
  exportAs: 'dbxActionDialog',
  selector: '[dbxActionDialog]'
})
export class DbxActionDialogDirective<T = unknown> extends AbstractDbxActionValueOnTriggerDirective<T> implements OnInit, OnDestroy {
  readonly elementRef = inject(ElementRef);

  readonly dbxActionDialog = input<Maybe<DbxActionDialogFunction<T>>>();
  readonly dbxActionDialogIsModified = input<Maybe<IsModifiedFunction>>();
  readonly dbxActionDialogIsEqual = input<Maybe<IsEqualFunction>>();

  constructor() {
    super();
    this.configureInputs({
      dbxActionValueOnTriggerIsModifiedSignal: this.dbxActionDialogIsModified,
      dbxActionValueOnTriggerIsEqualSignal: this.dbxActionDialogIsEqual
    });
    this.setValueGetterFunction(() => this._getDataFromDialog());
  }

  protected _getDataFromDialog(): Observable<Maybe<T>> {
    return this._makeDialogRef().afterClosed().pipe(first());
  }

  protected _makeDialogRef(): MatDialogRef<unknown, Maybe<T>> {
    const fn = this.dbxActionDialog();

    if (!fn) {
      throw new Error('dbxActionDialog has no dialog function provided to it.');
    }

    return fn();
  }
}
