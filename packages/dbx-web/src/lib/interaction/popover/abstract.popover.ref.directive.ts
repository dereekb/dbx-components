import { Directive, type ElementRef, output } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';
import { type NgPopoverCloseEvent, type NgPopoverRef } from 'ng-overlay-container';

/**
 * Abstract base directive for creating and managing a popover reference lifecycle, including open and close events.
 */
@Directive()
export abstract class AbstractPopoverRefDirective<T = unknown, R = unknown> {
  private _popoverRef?: NgPopoverRef<T, R>;

  protected readonly _popoverSub = cleanSubscription();

  showPopover(origin?: ElementRef): void {
    if (!this._popoverRef) {
      this._showPopoverRef(origin);
    }
  }

  private _showPopoverRef(origin?: ElementRef): void {
    const popoverRef = this._makePopoverRef(origin);
    this._popoverRef = popoverRef;
    this._afterOpened(popoverRef);
    this._popoverSub.setSub(
      popoverRef.afterClosed$.subscribe((x) => {
        this._afterClosed(x);
        this._popoverRef = undefined;
      })
    );
  }

  protected abstract _makePopoverRef(origin?: ElementRef): NgPopoverRef<T, R>;

  protected _afterOpened(_popoverRef: NgPopoverRef<T, R>): void {
    // Do nothing. Override in parent type
  }

  protected _afterClosed(_value: NgPopoverCloseEvent<R>): void {
    // Do nothing. Override in parent type
  }
}

/**
 * Extension of {@link AbstractPopoverRefDirective} that emits `popoverOpened` and `popoverClosed` output events.
 */
@Directive()
export abstract class AbstractPopoverRefWithEventsDirective<T = unknown, R = unknown> extends AbstractPopoverRefDirective<T, R> {
  readonly popoverOpened = output<NgPopoverRef<T, R>>();
  readonly popoverClosed = output<NgPopoverCloseEvent<R>>();

  protected override _afterOpened(popoverRef: NgPopoverRef<T, R>): void {
    this.popoverOpened.emit(popoverRef);
  }

  protected override _afterClosed(event: NgPopoverCloseEvent<R>): void {
    this.popoverClosed.emit(event);
  }
}
