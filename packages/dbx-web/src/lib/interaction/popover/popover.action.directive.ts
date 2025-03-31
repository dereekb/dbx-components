import { first, Observable, map } from 'rxjs';
import { Directive, OnInit, OnDestroy, Input, ElementRef, inject, input } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { AbstractDbxActionValueOnTriggerDirective } from '@dereekb/dbx-core';
import { IsEqualFunction, IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';

export interface DbxActionPopoverFunctionParams {
  origin: ElementRef;
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
export class DbxActionPopoverDirective<T = unknown> extends AbstractDbxActionValueOnTriggerDirective<T> implements OnInit, OnDestroy {
  readonly elementRef = inject(ElementRef);

  readonly dbxActionPopover = input<Maybe<DbxActionPopoverFunction<T>>>();
  readonly dbxActionPopoverIsModified = input<Maybe<IsModifiedFunction>>();
  readonly dbxActionPopoverIsEqual = input<Maybe<IsEqualFunction>>();

  constructor() {
    super();
    this.configureInputs({
      dbxActionValueOnTriggerIsModifiedSignal: this.dbxActionPopoverIsModified,
      dbxActionValueOnTriggerIsEqualSignal: this.dbxActionPopoverIsEqual
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

    if (!fn) {
      throw new Error('dbxActionPopover has no function provided to it yet.');
    }

    return fn({
      origin
    });
  }
}
