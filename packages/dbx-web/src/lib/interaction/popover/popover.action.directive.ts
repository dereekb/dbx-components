import { first, Observable, map } from 'rxjs';
import { Directive, OnInit, OnDestroy, Input, ElementRef } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxActionContextStoreSourceInstance, AbstractDbxActionValueOnTriggerDirective } from '@dereekb/dbx-core';
import { IsModifiedFunction } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';

export interface DbxActionPopoverFunctionParams {
  origin: ElementRef;
}

export type DbxActionPopoverFunction<T = unknown> = (params: DbxActionPopoverFunctionParams) => NgPopoverRef<unknown, Maybe<T>>;

/**
 * Action directive that is used to trigger/display a popover, then watches that popover for a value.
 */
@Directive({
  exportAs: 'dbxActionPopover',
  selector: '[dbxActionPopover]'
})
export class DbxActionPopoverDirective<T = unknown> extends AbstractDbxActionValueOnTriggerDirective<T> implements OnInit, OnDestroy {
  @Input('dbxActionPopover')
  fn?: DbxActionPopoverFunction<T>;

  @Input()
  set dbxActionPopoverModified(isModifiedFunction: Maybe<IsModifiedFunction>) {
    this.isModifiedFunction = isModifiedFunction;
  }

  constructor(readonly elementRef: ElementRef, source: DbxActionContextStoreSourceInstance<T, unknown>) {
    super(source, () => this._getDataFromPopover());
  }

  protected _getDataFromPopover(): Observable<Maybe<T>> {
    return this._makePopoverRef().afterClosed$.pipe(
      first(),
      map((x) => x.data)
    );
  }

  protected _makePopoverRef(): NgPopoverRef<unknown, Maybe<T>> {
    const origin = this.elementRef;

    if (!this.fn) {
      throw new Error('popoverAction has no function provided to it yet.');
    }

    return this.fn({
      origin
    });
  }
}
