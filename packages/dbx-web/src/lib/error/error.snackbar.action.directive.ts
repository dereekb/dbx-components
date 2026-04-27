import { Directive, inject, input } from '@angular/core';
import { DbxActionContextStoreSourceInstance, cleanSubscriptionWithLockSet } from '@dereekb/dbx-core';
import { DbxErrorSnackbarService } from './error.snackbar.service';
import { type Maybe, type Milliseconds, toReadableError } from '@dereekb/util';
import { type DbxErrorSnackbarConfig } from './error.snackbar.component';
import { filterMaybe } from '@dereekb/rxjs';

/**
 * Displays action errors in a snackbar notification.
 *
 * Subscribes to the action context's error stream and shows a snackbar via {@link DbxErrorSnackbarService}
 * whenever an error occurs. Accepts an optional configuration or a duration in milliseconds as input.
 *
 * @dbxWebComponent
 * @dbxWebSlug action-snackbar-error
 * @dbxWebCategory action
 * @dbxWebRelated action-snackbar
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <div [dbxActionSnackbarError]></div>
 * ```
 *
 * @example
 * ```html
 * <button [dbxAction]="saveAction" dbxActionSnackbarError>Save</button>
 * ```
 */
@Directive({
  selector: '[dbxActionSnackbarError]',
  standalone: true
})
export class DbxActionSnackbarErrorDirective {
  readonly dbxErrorSnackbarService = inject(DbxErrorSnackbarService);

  readonly source = inject(DbxActionContextStoreSourceInstance);

  readonly config = input<Maybe<DbxErrorSnackbarConfig> | Milliseconds | ''>(undefined, { alias: 'dbxActionSnackbarError' });

  constructor() {
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.source.error$.pipe(filterMaybe()).subscribe((inputError) => {
        const config = this.config();
        const error = toReadableError(inputError);

        const snackbarConfig = config ? (typeof config === 'number' ? { duration: config } : config) : undefined;
        this.dbxErrorSnackbarService.showSnackbarError(error, snackbarConfig);
      })
    });
  }
}
