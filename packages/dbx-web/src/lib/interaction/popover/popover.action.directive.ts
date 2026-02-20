import { first, Observable, map } from 'rxjs';
import { Directive, OnInit, OnDestroy, ElementRef, inject, input } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { AbstractDbxActionValueGetterDirective } from '@dereekb/dbx-core';
import { IsEqualFunction, IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';

export interface DbxActionPopoverFunctionParams {
  readonly origin: ElementRef;
}

export type DbxActionPopoverFunction<T = unknown> = (params: DbxActionPopoverFunctionParams) => NgPopoverRef<unknown, Maybe<T>>;

/**
 * Action directive that is used to trigger/display a popover, then watches that popover for a value.
 */
@Directive({
  exportAs: 'dbxActionPopover',
  selector: '[dbxActionPopover]',
  standalone: true
})
export class DbxActionPopoverDirective<T = unknown> extends AbstractDbxActionValueGetterDirective<T> {
  readonly elementRef = inject(ElementRef);

  readonly dbxActionPopover = input.required<DbxActionPopoverFunction<T>>();
  readonly dbxActionPopoverIsModified = input<Maybe<IsModifiedFunction>>();
  readonly dbxActionPopoverIsEqual = input<Maybe<IsEqualFunction>>();

  constructor() {
    super();
    this.configureInputs({
      isModifiedSignal: this.dbxActionPopoverIsModified,
      isEqualSignal: this.dbxActionPopoverIsEqual
    });
    this.setValueGetterFunction(() => this._getDataFromPopover());
  }

  protected _getDataFromPopover(): Observable<Maybe<T>> {
    return this._makePopoverRef().afterClosed$.pipe(
      first(),
      map((x) => x.data)
    );
  }

  protected _makePopoverRef(): NgPopoverRef<unknown, Maybe<T>> {
    const origin = this.elementRef;
    const fn = this.dbxActionPopover();

    return fn({
      origin
    });
  }
}
