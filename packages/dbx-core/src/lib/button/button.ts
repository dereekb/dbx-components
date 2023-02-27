import { Type, Provider, forwardRef } from '@angular/core';
import { Maybe } from '@dereekb/util';
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
export interface DbxButtonDisplayContent {
  /**
   * button Icon, if applicable
   */
  icon?: Maybe<string>;
  /**
   * button text, if applicable
   */
  text?: Maybe<string>;
}

export abstract class DbxButton implements DbxButtonDisplayContent {
  abstract readonly disabled$: Observable<boolean>;
  abstract readonly working$: Observable<boolean>;
  abstract disabled: Maybe<boolean>;
  abstract working: Maybe<boolean>;
  abstract icon?: Maybe<string>;
  abstract text?: Maybe<string>;
  abstract readonly clicked$: Observable<unknown>;
  abstract setButtonInterceptor(interceptor: DbxButtonInterceptor): void;
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
export type DbxButtonDisplayContentType = 'text_button' | 'icon_button';

/**
 * Delegate class used for retrieving the DbxButtonDisplayContent given an input value.
 */
export interface DbxButtonDisplayDelegate<T> {
  /**
   * Returns the DbxButtonDisplayContent for the input value.
   *
   * @param value
   */
  buttonDisplayContentForValue(value: T): DbxButtonDisplayContent;
}

/**
 * Returns the DbxButtonDisplayContentType given the input content.
 *
 * @param content
 * @returns
 */
export function dbxButtonDisplayContentType(content: DbxButtonDisplayContent): DbxButtonDisplayContentType {
  return !content.text && content.icon ? 'icon_button' : 'text_button';
}
