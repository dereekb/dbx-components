import { Directive, Input, Output, Type, Provider, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject, Observable, of, Subject, Subscription } from 'rxjs';
import { filter, first, mergeMap, switchMap, tap } from 'rxjs/operators';
import { AbstractSubscriptionDirective } from '../subscription';

/**
 * Used for intercepting button click events.
 *
 * Can be used to delay/modify trigger/click behaviors.
 */
export interface DbNgxButtonInterceptor {
  /**
   * Handles a button click event. Returns an observable that will say whether or not to continue the click event.
   */
  interceptButtonClick: () => Observable<boolean>;
}

/**
 * Abstract button component.
 */
@Directive()
export abstract class DbNgxButtonDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  @Input()
  disabled?: boolean;

  /**
   * Optional state to show the button is working.
   */
  @Input()
  working?: boolean;

  @Input()
  icon?: string;

  @Input()
  text?: string;

  @Output()
  readonly buttonClick = new EventEmitter();

  /**
   * Pre-interceptor button click.
   */
  protected _buttonClick = new Subject();
  protected _buttonInterceptor = new BehaviorSubject<Maybe<DbNgxButtonInterceptor>>(undefined);

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.sub = this._buttonClick.pipe(
      switchMap(() => this._buttonInterceptor.pipe(
        switchMap((x) => {
          if (x) {
            return x.interceptButtonClick().pipe(
              first()
            );
          } else {
            return of(true);
          }
        }),
        filter((x) => Boolean(x)) // Ignore false values.
      ))
    ).subscribe(() => {
      this._forceButtonClicked();
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._buttonClick.complete();
    this._buttonInterceptor.complete();
  }

  /**
   * Sets the button interceptor. If any interceptor is already set, it is replaced.
   */
  public setButtonInterceptor(interceptor: DbNgxButtonInterceptor): void {
    this._buttonInterceptor.next(interceptor);
  }

  /**
   * Main function to use for handling clicks on the button.
   */
  public clickButton(): void {
    if (!this.disabled) {
      this._buttonClick.next();
    }
  }

  /**
   * Forces a button click. Skips the interceptors if any are configured.
   */
  protected _forceButtonClicked(): void {
    this.buttonClick.emit();
  }

}

export function ProvideDbNgxButtonDirective<S extends DbNgxButtonDirective>(sourceType: Type<S>): Provider[] {
  return [{
    provide: DbNgxButtonDirective,
    useExisting: sourceType
  }];
}
