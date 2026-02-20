import { Directive, inject } from '@angular/core';
import { cleanSubscription, DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { DbxFileUploadActionCompatable } from './upload.action';

/**
 * Context used for linking a button to an ActionContext.
 */
@Directive({
  selector: '[dbxFileUploadActionSync]',
  standalone: true
})
export class DbxFileUploadActionSyncDirective {
  readonly source = inject(DbxActionContextStoreSourceInstance);
  readonly uploadCompatable = inject<DbxFileUploadActionCompatable>(DbxFileUploadActionCompatable);

  constructor() {
    cleanSubscription(
      this.source.isWorkingOrWorkProgress$.subscribe((working) => {
        this.uploadCompatable.setWorking(working);
      })
    );

    cleanSubscription(
      this.source.isDisabled$.subscribe((disabled) => {
        this.uploadCompatable.setDisabled(disabled);
      })
    );
  }
}
