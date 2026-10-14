import { Directive, type ElementRef, output } from '@angular/core';
import { clean, cleanSubscription } from '@dereekb/dbx-core';
import { type NgPopoverCloseEvent, type NgPopoverRef } from 'ng-overlay-container';

/**
 * Abstract base directive for creating and managing a popover reference lifecycle, including open and close events.
 *
 * The open popover is closed when the directive is destroyed, since it is anchored to the directive's element and usually
 * reads from the directive's injector. This also closes a popover that stays open across route transitions when its page is left.
 */
@Directive()
export abstract class AbstractPopoverRefDirective<T = unknown, R = unknown> {
  private _popoverRef?: NgPopoverRef<T, R>;

  protected readonly _popoverSub = cleanSubscription();

  constructor() {
    // registered after _popoverSub, so its afterClosed$ subscription is already gone and _afterClosed() does not run for a destroyed directive
    clean(() => this._popoverRef?.close());
  }

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
