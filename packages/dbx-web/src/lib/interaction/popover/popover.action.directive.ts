import { first, type Observable, map } from 'rxjs';
import { Directive, ElementRef, inject, input } from '@angular/core';
import { type NgPopoverRef } from 'ng-overlay-container';
import { AbstractDbxActionValueGetterDirective } from '@dereekb/dbx-core';
import { type IsEqualFunction, type IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';

/**
 * Parameters passed to a {@link DbxActionPopoverFunction} when opening a popover.
 */
export interface DbxActionPopoverFunctionParams {
  readonly origin: ElementRef;
}

/**
 * A function that opens a popover and returns its reference. Used with {@link DbxActionPopoverDirective}.
 */
export type DbxActionPopoverFunction<T = unknown> = (params: DbxActionPopoverFunctionParams) => NgPopoverRef<unknown, Maybe<T>>;

/**
 * Action directive that opens a popover and captures the returned value as the action's value.
 *
 * The directive triggers the provided popover function, waits for the popover to close, and uses the result as the action value.
 *
 * @example
 * ```html
 * <button [dbxActionPopover]="openMyPopover" dbxActionButton></button>
 * ```
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
