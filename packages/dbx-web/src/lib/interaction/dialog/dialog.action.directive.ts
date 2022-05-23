import { first, Observable } from 'rxjs';
import { Directive, OnInit, OnDestroy, Input, ElementRef } from '@angular/core';
import { DbxActionContextStoreSourceInstance, AbstractDbxActionValueOnTriggerDirective } from '@dereekb/dbx-core';
import { IsModifiedFunction } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
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

  @Input('dbxActionDialog')
  fn?: DbxActionDialogFunction<T>;

  @Input()
  set dbxActionDialogModified(isModifiedFunction: Maybe<IsModifiedFunction>) {
    this.isModifiedFunction = isModifiedFunction;
  }

  constructor(
    readonly elementRef: ElementRef,
    source: DbxActionContextStoreSourceInstance<T, unknown>
  ) {
    super(source, () => this._getDataFromDialog());
  }

  protected _getDataFromDialog(): Observable<Maybe<T>> {
    return this._makeDialogRef().afterClosed().pipe(first());
  }

  protected _makeDialogRef(): MatDialogRef<unknown, Maybe<T>> {
    if (!this.fn) {
      throw new Error('dbxActionDialog has no dialog function provided to it.');
    }

    return this.fn();
  }

}
