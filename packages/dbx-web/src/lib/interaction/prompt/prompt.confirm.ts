import { forwardRef, type Provider, type Type } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';

/**
 * Abstract class representing a confirmation prompt that shows a dialog and returns the user's decision.
 */
export abstract class DbxPromptConfirm {
  abstract showDialog(): Observable<Maybe<boolean>>;
}

/**
 * Provides a {@link DbxPromptConfirm} implementation for dependency injection.
 *
 * @param sourceType - The concrete class that implements {@link DbxPromptConfirm}
 * @returns An array of providers that register the given type as the {@link DbxPromptConfirm} implementation
 *
 * @example
 * ```ts
 * @Directive({ providers: provideDbxPromptConfirm(MyConfirmDirective) })
 * ```
 */
export function provideDbxPromptConfirm<S extends DbxPromptConfirm>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxPromptConfirm,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
