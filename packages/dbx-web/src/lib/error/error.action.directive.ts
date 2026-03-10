import { Directive, inject } from '@angular/core';
import { DbxActionContextStoreSourceInstance, cleanSubscription } from '@dereekb/dbx-core';
import { DbxErrorComponent } from './error.component';

/**
 * Links a {@link DbxErrorComponent} to an action context, automatically displaying the action's error state.
 *
 * Place this directive on a `<dbx-error>` element within an action context to have errors
 * from the action automatically forwarded to the error display.
 *
 * @example
 * ```html
 * <dbx-error dbxActionError></dbx-error>
 * ```
 */
@Directive({
  selector: '[dbxActionError]',
  standalone: true
})
export class DbxActionErrorDirective {
  readonly error = inject(DbxErrorComponent, { host: true });
  readonly source = inject(DbxActionContextStoreSourceInstance);

  constructor() {
    cleanSubscription(
      this.source.error$.subscribe((error) => {
        this.error.setError(error);
      })
    );
  }
}
