import { BehaviorSubject, Observable, of } from 'rxjs';
import { Directive, OnInit, OnDestroy, Input, ElementRef } from '@angular/core';
import { NgPopoverCloseEvent, NgPopoverRef } from 'ng-overlay-container';
import { AbstractPopoverRefWithEventsDirective } from './abstract.popover.ref.directive';
import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { filterMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { first, switchMap } from 'rxjs/operators';
import { Maybe } from '@dereekb/util';

export interface DbxPopoverActionFnParam {
  origin: ElementRef;
}

export type DbxPopoverActionFn<T = object> = (params: DbxPopoverActionFnParam) => NgPopoverRef<any, T>;
export type DbxPopoverActionModifiedFn<T = any> = (value: T) => Observable<boolean>;

/**
 * Action directive that is used to trigger/display a popover,
 * then watches that popover for a value.
 *
 * The value is passed to the isModified function (ifProvided), and if that returns true it will 
 */
@Directive({
  exportAs: 'popoverAction',
  selector: '[dbxPopoverAction]'
})
export class DbxPopoverActionDirective<T = object> extends AbstractPopoverRefWithEventsDirective<any, T> implements OnInit, OnDestroy {

  @Input('dbxPopoverAction')
  fn?: DbxPopoverActionFn<T>;

  @Input()
  appPopoverActionModified?: DbxPopoverActionModifiedFn<T>;

  private _popoverValue = new BehaviorSubject<Maybe<T>>(undefined);

  private _triggeredSub = new SubscriptionObject();
  private _isModifiedSub = new SubscriptionObject();

  constructor(
    readonly elementRef: ElementRef,
    readonly source: DbxActionContextStoreSourceInstance<T, any>
  ) {
    super();
  }

  ngOnInit(): void {

    // Used for triggering isModified on the action.
    this._isModifiedSub.subscription = this._popoverValue.pipe(
      filterMaybe(),
      switchMap((value) => {
        let isModifiedObs: Observable<boolean>;

        if (this.appPopoverActionModified) {
          isModifiedObs = this.appPopoverActionModified(value).pipe(first());
        } else {
          isModifiedObs = of(true);  // Considered modified
        }

        return isModifiedObs;
      })
    ).subscribe((isModified) => {
      this.source.setIsModified(isModified);
    });

    // Ready the value after the source is triggered.
    this._triggeredSub.subscription = this.source.triggered$.pipe(
      switchMap(() => {
        return this._popoverValue.pipe(
          filterMaybe(),
          first()
        );
      })
    ).subscribe((x) => {
      this.source.readyValue(x);
    });
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this._triggeredSub.destroy();
      this._popoverValue.complete();
    });
  }

  protected _makePopoverRef(): NgPopoverRef<any, T> {
    const origin = this.elementRef;

    if (!this.fn) {
      throw new Error('popoverAction has no function provided to it yet.');
    }

    return this.fn({
      origin
    });
  }

  protected override _afterClosed(event: NgPopoverCloseEvent<T>): void {
    super._afterClosed(event);
    const { data } = event;

    if (data != null) {
      this._popoverValue.next(data);
    }
  }

}
