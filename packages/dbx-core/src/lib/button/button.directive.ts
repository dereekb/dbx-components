import { Directive, OnDestroy, OnInit, Signal, computed, input, output, signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { of, Subject, filter, first, switchMap, BehaviorSubject } from 'rxjs';
import { AbstractSubscriptionDirective } from '../subscription';
import { DbxButton, DbxButtonDisplay, DbxButtonDisplayType, dbxButtonDisplayType, DbxButtonInterceptor, DbxButtonWorking, provideDbxButton } from './button';
import { outputToObservable, toObservable } from '@angular/core/rxjs-interop';

/**
 * Abstract button component.
 */
@Directive()
export abstract class AbstractDbxButtonDirective extends AbstractSubscriptionDirective implements DbxButton, OnInit, OnDestroy {
  /**
   * Pre-interceptor button click.
   */
  protected readonly _buttonClick = new Subject<void>();
  protected readonly _buttonInterceptor = new BehaviorSubject<Maybe<DbxButtonInterceptor>>(undefined);

  readonly buttonClick = output();

  readonly disabled = input<boolean, Maybe<boolean>>(false, { transform: Boolean });
  readonly working = input<DbxButtonWorking, Maybe<DbxButtonWorking>>(false, { transform: (x) => (x == null ? false : x) });
  readonly buttonDisplay = input<Maybe<DbxButtonDisplay>>(undefined);

  private readonly _disabledSignal = signal<Maybe<boolean>>(undefined);
  private readonly _workingSignal = signal<Maybe<DbxButtonWorking>>(undefined);
  private readonly _buttonDisplayContentSignal = signal<Maybe<DbxButtonDisplay>>(undefined);

  readonly disabledSignal = computed(() => this._disabledSignal() ?? this.disabled());
  readonly workingSignal = computed(() => this._workingSignal() ?? this.working());

  readonly icon = input<Maybe<string>>();
  readonly text = input<Maybe<string>>();

  readonly buttonDisplayContentSignal: Signal<DbxButtonDisplay> = computed(() => {
    const icon = this.icon();
    const text = this.text();
    const buttonDisplay = this.buttonDisplay();

    const buttonDisplayContent = this._buttonDisplayContentSignal() ?? buttonDisplay;
    return { icon: icon || buttonDisplayContent?.icon, text: text || buttonDisplayContent?.text };
  });

  readonly buttonDisplayTypeSignal: Signal<DbxButtonDisplayType> = computed(() => {
    return dbxButtonDisplayType(this.buttonDisplayContentSignal());
  });

  readonly iconSignal: Signal<Maybe<string>> = computed(() => this.buttonDisplayContentSignal()?.icon);
  readonly textSignal: Signal<Maybe<string>> = computed(() => this.buttonDisplayContentSignal()?.text);

  readonly disabled$ = toObservable(this.disabledSignal);
  readonly working$ = toObservable(this.workingSignal);
  readonly display$ = toObservable(this.buttonDisplayContentSignal);
  readonly clicked$ = outputToObservable(this.buttonClick);

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
    this._buttonClick.complete();
    this._buttonInterceptor.complete();
  }

  setDisabled(disabled?: Maybe<boolean>): void {
    this._disabledSignal.set(disabled);
  }

  setWorking(working?: Maybe<DbxButtonWorking>): void {
    this._workingSignal.set(working);
  }

  setDisplayContent(content: DbxButtonDisplay): void {
    this._buttonDisplayContentSignal.set(content);
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
    if (!this.disabled()) {
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
  providers: provideDbxButton(DbxButtonDirective),
  standalone: true
})
export class DbxButtonDirective extends AbstractDbxButtonDirective {}
