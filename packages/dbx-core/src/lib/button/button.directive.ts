import { Directive, type Signal, computed, input, output, signal } from '@angular/core';
import { isDefinedAndNotFalse, type Maybe } from '@dereekb/util';
import { of, Subject, filter, first, switchMap, BehaviorSubject } from 'rxjs';
import { emitDelayObs } from '@dereekb/rxjs';
import { cleanSubscription, completeOnDestroy } from '../rxjs';
import { type DbxButton, type DbxButtonDisplay, type DbxButtonDisplayType, dbxButtonDisplayType, type DbxButtonEcho, type DbxButtonInterceptor, type DbxButtonWorking, DEFAULT_DBX_BUTTON_ECHO_DURATION, provideDbxButton } from './button';
import { outputToObservable, toObservable, toSignal } from '@angular/core/rxjs-interop';

/**
 * Abstract base directive implementing the {@link DbxButton} interface with signal-based state management.
 *
 * Manages disabled state, working/progress state, display content (icon/text),
 * and button click interception. Subclass this to create custom button directives.
 *
 * @example
 * ```typescript
 * @Directive({
 *   selector: '[myButton]',
 *   providers: provideDbxButton(MyButtonDirective),
 * })
 * export class MyButtonDirective extends AbstractDbxButtonDirective {}
 * ```
 */
@Directive()
export abstract class AbstractDbxButtonDirective implements DbxButton {
  /**
   * Pre-interceptor button click.
   */
  protected readonly _buttonClick = completeOnDestroy(new Subject<void>());
  protected readonly _buttonInterceptor = completeOnDestroy(new BehaviorSubject<Maybe<DbxButtonInterceptor>>(undefined));
  private readonly _buttonEcho$ = completeOnDestroy(new Subject<DbxButtonEcho>());

  /**
   * Current active button echo, or undefined when no echo is active.
   * Each new echo cancels the previous one via switchMap.
   */
  readonly buttonEchoSignal: Signal<Maybe<DbxButtonEcho>> = toSignal(this._buttonEcho$.pipe(switchMap((echo) => emitDelayObs<Maybe<DbxButtonEcho>>(echo, undefined, echo.duration ?? DEFAULT_DBX_BUTTON_ECHO_DURATION))), { initialValue: undefined });

  readonly buttonClick = output();

  readonly ariaLabel = input<Maybe<string>>(undefined);

  readonly disabled = input<boolean, Maybe<boolean>>(false, { transform: Boolean });
  readonly working = input<DbxButtonWorking, Maybe<DbxButtonWorking>>(false, { transform: (x) => (x == null ? false : x) });
  readonly buttonDisplay = input<Maybe<DbxButtonDisplay>>(undefined);

  private readonly _disabledSignal = signal<Maybe<boolean>>(undefined);
  private readonly _workingSignal = signal<Maybe<DbxButtonWorking>>(undefined);
  private readonly _buttonDisplayContentSignal = signal<Maybe<DbxButtonDisplay>>(undefined);

  readonly disabledSignal = computed(() => this._disabledSignal() ?? this.disabled());
  readonly workingSignal = computed(() => this._workingSignal() ?? this.working());

  readonly isWorkingSignal = computed(() => {
    const working = this.workingSignal();
    return isDefinedAndNotFalse(working);
  });

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

  constructor() {
    cleanSubscription(
      this._buttonClick
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
        })
    );
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

  showButtonEcho(echo: DbxButtonEcho): void {
    this._buttonEcho$.next(echo);
  }

  /**
   * Sets the button interceptor. If any interceptor is already set, it is replaced.
   *
   * @param interceptor - The interceptor to set on the button.
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
 * Concrete button directive that provides a {@link DbxButton} instance via DI.
 *
 * Apply to any element to make it a managed button with reactive disabled,
 * working, and display state.
 *
 * @example
 * ```html
 * <button dbxButton [icon]="'save'" [text]="'Save'" [disabled]="isSaving">
 *   Save
 * </button>
 * ```
 *
 * @example
 * ```html
 * <!-- Access the button instance via template reference: -->
 * <button dbxButton #btn="dbxButton" (click)="btn.clickButton()">Submit</button>
 * ```
 */
@Directive({
  selector: '[dbxButton]',
  exportAs: 'dbxButton',
  providers: provideDbxButton(DbxButtonDirective),
  standalone: true
})
export class DbxButtonDirective extends AbstractDbxButtonDirective {}
