import { OnDestroy, Directive, EventEmitter, Output, ElementRef, output } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { NgPopoverCloseEvent, NgPopoverRef } from 'ng-overlay-container';

/**
 * Abstract class for showing and handling a popover ref.
 */
@Directive()
export abstract class AbstractPopoverRefDirective<T = unknown, R = unknown> extends AbstractSubscriptionDirective {
  private _popoverRef?: NgPopoverRef<T, R>;

  showPopover(origin?: ElementRef): void {
    if (!this._popoverRef) {
      this._showPopoverRef(origin);
    }
  }

  private _showPopoverRef(origin?: ElementRef): void {
    this._popoverRef = this._makePopoverRef(origin);
    this._afterOpened(this._popoverRef);
    this.sub = this._popoverRef.afterClosed$.subscribe((x) => {
      this._afterClosed(x);
      this._popoverRef = undefined;
    });
  }

  protected abstract _makePopoverRef(origin?: ElementRef): NgPopoverRef<T, R>;

  protected _afterOpened(popoverRef: NgPopoverRef<T, R>): void {
    // Do nothing. Override in parent type
  }

  protected _afterClosed(value: NgPopoverCloseEvent<R>): void {
    // Do nothing. Override in parent type
  }
}

/**
 * {@link AbstractPopoverRefDirective} extension that includes open/closed events.
 */
@Directive()
export abstract class AbstractPopoverRefWithEventsDirective<T = unknown, R = unknown> extends AbstractPopoverRefDirective<T, R> implements OnDestroy {
  readonly popoverOpened = output<NgPopoverRef<T, R>>();
  readonly popoverClosed = output<NgPopoverCloseEvent<R>>();

  protected override _afterOpened(popoverRef: NgPopoverRef<T, R>): void {
    this.popoverOpened.emit(popoverRef);
  }

  protected override _afterClosed(event: NgPopoverCloseEvent<R>): void {
    this.popoverClosed.emit(event);
  }
}
