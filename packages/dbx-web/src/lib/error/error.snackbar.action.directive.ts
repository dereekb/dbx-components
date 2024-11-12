import { Directive, Input, OnInit, inject } from '@angular/core';
import { DbxActionContextStoreSourceInstance, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxErrorSnackbarService } from './error.snackbar.service';
import { Maybe, Milliseconds, toReadableError } from '@dereekb/util';
import { DbxErrorSnackbarConfig } from './error.snackbar.component';
import { filterMaybe } from '@dereekb/rxjs';

/**
 * Context used for displaying an error from an ActionContext a snackbar when an ReadableErrorComponent
 */
@Directive({
  selector: '[dbxActionSnackbarError]'
})
export class DbxActionSnackbarErrorDirective extends AbstractSubscriptionDirective implements OnInit {
  readonly dbxErrorSnackbarService = inject(DbxErrorSnackbarService);
  readonly source = inject(DbxActionContextStoreSourceInstance);

  @Input('dbxActionSnackbarError')
  config?: Maybe<DbxErrorSnackbarConfig> | Milliseconds | '';

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.error$.pipe(filterMaybe()).subscribe((inputError) => {
      const error = toReadableError(inputError);
      const config = this.config ? (typeof this.config === 'number' ? { duration: this.config } : this.config) : undefined;
      this.dbxErrorSnackbarService.showSnackbarError(error, config);
    });
  }
}
