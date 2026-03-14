import { Directive } from '@angular/core';
import { AbstractForwardDbxInjectionContextDirective } from '@dereekb/dbx-core';
import { DbxFirebaseLoginContext } from './login.context';

/**
 * Directive providing a {@link DbxFirebaseLoginContext} for login component injection.
 *
 * Apply to a host element to establish a login context scope for child login components.
 */
@Directive({
  selector: '[dbxFirebaseLoginContext]',
  standalone: true,
  providers: [
    {
      provide: DbxFirebaseLoginContext,
      useExisting: DbxFirebaseLoginContextDirective
    }
  ]
})
export class DbxFirebaseLoginContextDirective extends AbstractForwardDbxInjectionContextDirective implements DbxFirebaseLoginContext {}
