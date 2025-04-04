import { Type, Provider, forwardRef } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';

/**
 * Used for intercepting button click events.
 *
 * Can be used to delay/modify trigger/click behaviors.
 */
export interface DbxButtonInterceptor {
  /**
   * Handles a button click event. Returns an observable that will say whether or not to continue the click event.
   */
  interceptButtonClick: () => Observable<boolean>;
}

/**
 * Text and icon display content for a button.
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

export abstract class DbxButton {
  /**
   * Observable of the disabled state of the button.
   */
  abstract readonly disabled$: Observable<boolean>;
  /**
   * Observable of the working state of the button.
   */
  abstract readonly working$: Observable<boolean>;
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
   * Sets the working state of the button. IF null/undefined the button will be marked as working.
   *
   * @param working
   */
  abstract setWorking(working?: Maybe<boolean>): void;
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
 * Delegate class used for retrieving the DbxButtonDisplay given an input value.
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
 * Returns the DbxButtonDisplayType given the input content.
 *
 * @param content
 * @returns
 */
export function dbxButtonDisplayType(content: DbxButtonDisplay): DbxButtonDisplayType {
  return !content.text && content.icon ? 'icon_button' : 'text_button';
}
