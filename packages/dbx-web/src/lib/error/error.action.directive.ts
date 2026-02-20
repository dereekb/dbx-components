import { Directive, inject } from '@angular/core';
import { DbxActionContextStoreSourceInstance, cleanSubscription } from '@dereekb/dbx-core';
import { DbxErrorComponent } from './error.component';

/**
 * Context used for linking an ReadableErrorComponent to an ActionContext.
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
