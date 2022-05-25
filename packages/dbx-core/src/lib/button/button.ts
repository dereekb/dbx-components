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

export abstract class DbxButton {
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
  return [{
    provide: DbxButton,
    useExisting: forwardRef(() => sourceType)
  }];
}
