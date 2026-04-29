import { Directive, inject } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';
import { DbxForm } from '../form';

/**
 * Debug directive that logs every form stream event to the console.
 *
 * Subscribes to the parent form's {@link DbxForm.stream$} and prints each event snapshot
 * via `console.log`. Useful during development to inspect the form lifecycle and state transitions.
 *
 * @selector `[dbxFormLogger]`
 *
 * @example
 * ```html
 * <dbx-form>
 *   <ng-container dbxFormLogger></ng-container>
 *   <!-- form fields -->
 * </dbx-form>
 * ```
 */
@Directive({
  selector: '[dbxFormLogger],[dbxFormStreamLogger]',
  standalone: true
})
export class DbxFormLoggerDirective {
  readonly form = inject(DbxForm, { host: true });

  constructor() {
    cleanSubscription(
      this.form.stream$.subscribe((event) => {
        console.log('dbxFormLogger - stream: ', event);
      })
    );
  }
}
