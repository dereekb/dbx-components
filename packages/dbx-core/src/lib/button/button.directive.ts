import { Directive, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject, of, Subject, filter, first, switchMap } from 'rxjs';
import { AbstractSubscriptionDirective } from '../subscription';
import { DbxButton, DbxButtonDisplayContent, DbxButtonInterceptor, provideDbxButton } from './button';

/**
 * Abstract button component.
 */
@Directive()
export abstract class AbstractDbxButtonDirective extends AbstractSubscriptionDirective implements DbxButton, OnInit, OnDestroy {
  private _disabled = new BehaviorSubject<boolean>(false);
  private _working = new BehaviorSubject<boolean>(false);

  readonly disabled$ = this._disabled.asObservable();
  readonly working$ = this._working.asObservable();

  @Input()
  get disabled(): boolean {
    return this._disabled.value;
  }

  set disabled(disabled: boolean) {
    this._disabled.next(disabled);
  }

  @Input()
  get working(): boolean {
    return this._working.value;
  }

  set working(working: boolean) {
    this._working.next(working);
  }

  @Input()
  icon?: Maybe<string>;

  @Input()
  text?: Maybe<string>;

  @Input()
  get buttonDisplay(): DbxButtonDisplayContent {
    return {
      icon: this.icon,
      text: this.text
    };
  }

  set buttonDisplay(buttonDisplay: Maybe<DbxButtonDisplayContent>) {
    this.icon = buttonDisplay?.icon;
    this.text = buttonDisplay?.text;
  }

  @Output()
  readonly buttonClick = new EventEmitter();

  readonly clicked$ = this.buttonClick.asObservable();

  constructor() {
    super();
  }

  /**
   * Pre-interceptor button click.
   */
  protected _buttonClick = new Subject<void>();
  protected _buttonInterceptor = new BehaviorSubject<Maybe<DbxButtonInterceptor>>(undefined);

  ngOnInit(): void {
    this.sub = this._buttonClick
      .pipe(
        switchMap(() =>
          this._buttonInterceptor.pipe(
            switchMap((x) => {
              if (x) {
                return x.interceptButtonClick().pipe(first());
              } else {
                return of(true);
              }
            }),
            filter((x) => Boolean(x)) // Ignore false values.
          )
        )
      )
      .subscribe(() => {
        this._forceButtonClicked();
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._disabled.complete();
    this._working.complete();
    this._buttonClick.complete();
    this._buttonInterceptor.complete();
  }

  /**
   * Sets the button interceptor. If any interceptor is already set, it is replaced.
   */
  public setButtonInterceptor(interceptor: DbxButtonInterceptor): void {
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

// MARK: Implementation
/**
 * Provides an DbxButton directive.
 */
@Directive({
  selector: '[dbxButton]',
  exportAs: 'dbxButton',
  providers: provideDbxButton(DbxButtonDirective)
})
export class DbxButtonDirective extends AbstractDbxButtonDirective {}
