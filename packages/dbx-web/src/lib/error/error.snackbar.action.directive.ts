import { Directive, inject, input } from '@angular/core';
import { DbxActionContextStoreSourceInstance, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxErrorSnackbarService } from './error.snackbar.service';
import { Maybe, Milliseconds, toReadableError } from '@dereekb/util';
import { DbxErrorSnackbarConfig } from './error.snackbar.component';
import { filterMaybe } from '@dereekb/rxjs';

/**
 * Context used for displaying an error from an ActionContext a snackbar when an ReadableErrorComponent
 */
@Directive({
  selector: '[dbxActionSnackbarError]',
  standalone: true
})
export class DbxActionSnackbarErrorDirective extends AbstractSubscriptionDirective {
  readonly dbxErrorSnackbarService = inject(DbxErrorSnackbarService);
  readonly source = inject(DbxActionContextStoreSourceInstance);

  readonly config = input<Maybe<DbxErrorSnackbarConfig> | Milliseconds | ''>(undefined, { alias: 'dbxActionSnackbarError' });

  constructor() {
    super();
    this.sub = this.source.error$.pipe(filterMaybe()).subscribe((inputError) => {
      const config = this.config();
      const error = toReadableError(inputError);

      const snackbarConfig = config ? (typeof config === 'number' ? { duration: config } : config) : undefined;
      this.dbxErrorSnackbarService.showSnackbarError(error, snackbarConfig);
    });
  }
}
