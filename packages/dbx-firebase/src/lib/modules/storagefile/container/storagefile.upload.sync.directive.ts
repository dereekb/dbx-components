import { Directive, inject } from '@angular/core';
import { DbxFirebaseStorageFileUploadStore } from '../store';
import { DbxFileUploadComponent } from '@dereekb/dbx-web';
import { cleanSubscription } from '@dereekb/dbx-core';

/**
 * Directive that syncs a DbxFirebaseStorageFileUploadStore's configuration to a DbxFileUploadComponent.
 */
@Directive({
  selector: '[dbxFirebaseStorageFileUploadSync]',
  exportAs: 'dbxFirebaseStorageFileUploadSync',
  standalone: true
})
export class DbxFirebaseStorageFileUploadSyncDirective {
  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);
  readonly uploadComponent = inject(DbxFileUploadComponent);

  constructor() {
    cleanSubscription(this.uploadStore.fileTypesAllowed$.subscribe((x) => this.uploadComponent.setAccept(x)));
    cleanSubscription(this.uploadStore.isMultiUploadAllowed$.subscribe((x) => this.uploadComponent.setMultiple(x)));
    cleanSubscription(this.uploadComponent.filesChanged.subscribe((files) => this.uploadStore.setFiles(files.matchResult.accepted)));
  }
}
