import { Directive } from '@angular/core';
import { AbstractForwardDbxInjectionContextDirective } from '@dereekb/dbx-core';
import { DbxFirebaseLoginContext } from './login.context';

/**
 * DbxFirebaseLoginContext implementation.
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
