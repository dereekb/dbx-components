import { type Type, type Provider, forwardRef } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type DbxActionWorkProgress, type DbxActionWorkOrWorkProgress } from '../action/action';

/**
 * Progress value for a button's working state, expressed as a percentage (0-100).
 */
export type DbxButtonWorkingProgress = DbxActionWorkProgress;

/**
 * Working state for a button. When `true`, indicates indeterminate progress.
 * When a number, indicates determinate progress as a percentage (0-100).
 * When `false` or `undefined`, the button is not in a working state.
 */
export type DbxButtonWorking = DbxActionWorkOrWorkProgress;

/**
 * Intercepts button click events to conditionally allow or prevent the click from propagating.
 *
 * Useful for adding confirmation dialogs, permission checks, or other pre-click validation.
 *
 * @example
 * ```typescript
 * const confirmInterceptor: DbxButtonInterceptor = {
 *   interceptButtonClick: () => {
 *     return from(window.confirm('Are you sure?')).pipe(map(Boolean));
 *   },
 * };
 * ```
 */
export interface DbxButtonInterceptor {
  /**
   * Handles a button click event. Returns an observable that will say whether or not to continue the click event.
   */
  interceptButtonClick: () => Observable<boolean>;
}

/**
 * Display configuration for a button, including optional icon and text.
 *
 * @example
 * ```typescript
 * const display: DbxButtonDisplay = { icon: 'save', text: 'Save Changes' };
 * ```
 */
export interface DbxButtonDisplay {
  /**
   * button Icon, if applicable
   */
  readonly icon?: Maybe<string>;
  /**
   * button text, if applicable
   */
  readonly text?: Maybe<string>;
}

/**
 * Abstract base class defining the reactive interface for a button component.
 *
 * Provides observable streams for disabled state, working state, click events,
 * and display content. Implementations are provided via DI using {@link provideDbxButton}.
 *
 * @see {@link AbstractDbxButtonDirective} for the default implementation.
 * @see {@link DbxButtonDirective} for the concrete directive.
 */
export abstract class DbxButton {
  /**
   * Observable of the disabled state of the button.
   */
  abstract readonly disabled$: Observable<boolean>;
  /**
   * Observable of the working state of the button.
   */
  abstract readonly working$: Observable<DbxButtonWorking>;
  /**
   * Observable of the clicked event of the button.
   */
  abstract readonly clicked$: Observable<unknown>;
  /**
   * Observable of the display content of the button.
   */
  abstract readonly display$: Observable<DbxButtonDisplay>;
  /**
   * Sets the disabled state of the button. If null/undefined the button will be disabled.
   *
   * @param disabled
   */
  abstract setDisabled(disabled?: Maybe<boolean>): void;
  /**
   * Sets the working state of the button.
   *
   * If a number is passed, then it is treated as a progress percentage.
   *
   * If true is passed, then it is treated as an indeterminate progress.
   *
   * If null/undefined is passed, then the button will not be working.
   */
  abstract setWorking(working?: Maybe<DbxButtonWorking>): void;
  /**
   * Sets the display content of the button.
   *
   * @param content
   */
  abstract setDisplayContent(content: DbxButtonDisplay): void;
  /**
   * Sets the button interceptor. If any interceptor is already set, it is replaced.
   *
   * @param interceptor
   */
  abstract setButtonInterceptor(interceptor: DbxButtonInterceptor): void;
  /**
   * Main function to use for handling clicks on the button.
   */
  abstract clickButton(): void;
}

/**
 * Creates Angular providers that register a {@link DbxButton} implementation for DI.
 *
 * @param sourceType - The concrete button directive or component class to provide.
 *
 * @example
 * ```typescript
 * @Directive({
 *   selector: '[myCustomButton]',
 *   providers: provideDbxButton(MyCustomButtonDirective),
 * })
 * export class MyCustomButtonDirective extends AbstractDbxButtonDirective {}
 * ```
 */
export function provideDbxButton<S extends DbxButton>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxButton,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}

// MARK: Display
/**
 * The display type of a button.
 *
 * text_button: A text button has text or is empty.
 * icon_button: An icon button only has an icon and no text.
 */
export type DbxButtonDisplayType = 'text_button' | 'icon_button';

/**
 * Delegate for computing a {@link DbxButtonDisplay} from a given value.
 *
 * Useful for dynamically updating button appearance based on data state.
 *
 * @typeParam T - The type of value used to derive the display configuration.
 */
export interface DbxButtonDisplayDelegate<T> {
  /**
   * Returns the DbxButtonDisplay for the input value.
   *
   * @param value
   */
  buttonDisplayContentForValue(value: T): DbxButtonDisplay;
}

/**
 * Determines whether a button display is an icon-only button or a text button.
 *
 * @param content - The button display configuration to evaluate.
 * @returns `'icon_button'` if only an icon is set, otherwise `'text_button'`.
 *
 * @example
 * ```typescript
 * dbxButtonDisplayType({ icon: 'edit' }); // 'icon_button'
 * dbxButtonDisplayType({ icon: 'save', text: 'Save' }); // 'text_button'
 * ```
 */
export function dbxButtonDisplayType(content: DbxButtonDisplay): DbxButtonDisplayType {
  return !content.text && content.icon ? 'icon_button' : 'text_button';
}
