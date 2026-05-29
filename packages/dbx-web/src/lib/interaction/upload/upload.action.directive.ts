import { Directive, inject } from '@angular/core';
import { cleanSubscriptionWithLockSet, DbxActionContextStoreSourceInstance, DbxActionWorkable } from '@dereekb/dbx-core';

/**
 * Syncs the disabled and working states from an ActionContextStoreSource to a {@link DbxActionWorkable} target.
 *
 * The target is any element that provides {@link DbxActionWorkable} -- a {@link DbxFileUploadActionCompatable}
 * file upload component, or a {@link DbxButton} (e.g. `<dbx-button>`).
 *
 * @example
 * ```html
 * <dbx-file-upload-button dbxFileUploadActionSync (filesChanged)="onFiles($event)"></dbx-file-upload-button>
 * ```
 *
 * @example
 * ```html
 * <dbx-button dbxFileUploadActionSync></dbx-button>
 * ```
 */
@Directive({
  selector: '[dbxFileUploadActionSync]',
  standalone: true
})
export class DbxFileUploadActionSyncDirective {
  readonly source = inject(DbxActionContextStoreSourceInstance);
  readonly workable = inject<DbxActionWorkable>(DbxActionWorkable);

  constructor() {
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.source.isWorkingOrWorkProgress$.subscribe((working) => {
        this.workable.setWorking(working);
      })
    });

    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.source.isDisabled$.subscribe((disabled) => {
        this.workable.setDisabled(disabled);
      })
    });
  }
}
