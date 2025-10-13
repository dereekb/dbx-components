import { Directive, inject, OnDestroy } from '@angular/core';
import { DbxFirebaseStorageFileUploadStore, StorageFileDocumentStore } from '../store';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { FirebaseStorageAccessorFile } from '@dereekb/firebase';

/**
 * Directive that passes the upload result to a StorageFileDocumentStore to initialize the document immediately.
 */
@Directive({
  selector: '[dbxFirebaseStorageFileUploadInitializeDocument]',
  exportAs: 'dbxFirebaseStorageFileUploadInitializeDocument',
  standalone: true
})
export class DbxFirebaseStorageFileUploadInitializeDocumentDirective extends AbstractSubscriptionDirective implements OnDestroy {
  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);
  readonly storageFileDocumentStore = inject(StorageFileDocumentStore);

  constructor() {
    super();

    this.sub = this.uploadStore.uploadResult$.subscribe(async (result) => {
      const successFileResult = result.successFileResults.find((x) => x.fileRef != null);

      if (successFileResult) {
        const fileRef = successFileResult.fileRef as FirebaseStorageAccessorFile;

        if (fileRef) {
          this.storageFileDocumentStore
            .initializeStorageFileFromUpload({
              pathString: fileRef.storagePath.pathString,
              bucketId: fileRef.storagePath.bucketId
            })
            .subscribe();
        }
      }
    });
  }
}
