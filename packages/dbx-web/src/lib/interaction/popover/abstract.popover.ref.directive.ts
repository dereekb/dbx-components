import { OnDestroy, Directive, EventEmitter, Output } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { NgPopoverCloseEvent, NgPopoverRef } from 'ng-overlay-container';

/**
 * Abstract class for showing and handling a popover ref.
 */
@Directive()
export abstract class AbstractPopoverRefDirective<T = unknown, R = unknown> extends AbstractSubscriptionDirective {
  private _popoverRef?: NgPopoverRef<T, R>;

  showPopover(): void {
    if (!this._popoverRef) {
      this._showPopoverRef();
    }
  }

  private _showPopoverRef(): void {
    this._popoverRef = this._makePopoverRef();
    this._afterOpened(this._popoverRef);
    this.sub = this._popoverRef.afterClosed$.subscribe((x) => {
      this._afterClosed(x);
      this._popoverRef = undefined;
    });
  }

  protected abstract _makePopoverRef(): NgPopoverRef<T, R>;

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
  @Output()
  readonly popoverOpened = new EventEmitter<NgPopoverRef<T, R>>();

  @Output()
  readonly popoverClosed = new EventEmitter<NgPopoverCloseEvent<R>>();

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.popoverClosed.complete();
    this.popoverOpened.complete();
  }

  protected override _afterOpened(popoverRef: NgPopoverRef<T, R>): void {
    this.popoverOpened.next(popoverRef);
  }

  protected override _afterClosed(event: NgPopoverCloseEvent<R>): void {
    this.popoverClosed.next(event);
  }
}
