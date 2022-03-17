import { first, Observable } from 'rxjs';
import { Directive, OnInit, OnDestroy, Input, ElementRef } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxActionContextStoreSourceInstance, AbstractDbxActionValueOnTriggerDirective } from '@dereekb/dbx-core';
import { IsModifiedFunction } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { map } from 'rxjs';

export interface DbxActionPopoverFunctionParams {
  origin: ElementRef;
}

export type DbxActionPopoverFunction<T = any> = (params: DbxActionPopoverFunctionParams) => NgPopoverRef<any, Maybe<T>>;

/**
 * Action directive that is used to trigger/display a popover, then watches that popover for a value.
 */
@Directive({
  exportAs: 'dbxActionPopover',
  selector: '[dbxActionPopover]'
})
export class DbxActionPopoverDirective<T = any> extends AbstractDbxActionValueOnTriggerDirective<T> implements OnInit, OnDestroy {

  @Input('dbxActionPopover')
  fn?: DbxActionPopoverFunction<T>;

  @Input()
  set dbxActionPopoverModified(isModifiedFunction: Maybe<IsModifiedFunction>) {
    this.isModifiedFunction = isModifiedFunction;
  }

  constructor(
    readonly elementRef: ElementRef,
    source: DbxActionContextStoreSourceInstance<T, any>
  ) {
    super(source, () => this._getDataFromPopover());
  }

  protected _getDataFromPopover(): Observable<Maybe<T>> {
    return this._makePopoverRef().afterClosed$.pipe(first(), map(x => x.data));
  }

  protected _makePopoverRef(): NgPopoverRef<any, Maybe<T>> {
    const origin = this.elementRef;

    if (!this.fn) {
      throw new Error('popoverAction has no function provided to it yet.');
    }

    return this.fn({
      origin
    });
  }

}
