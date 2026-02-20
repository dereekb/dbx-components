import { Directive, inject, input } from '@angular/core';
import { DbxFirebaseStorageFileUploadStore, StorageFileDocumentStore } from '../store';
import { DbxActionContextStoreSourceInstance, DbxActionHandlerInstance, clean, cleanSubscription } from '@dereekb/dbx-core';
import { FirebaseStorageAccessorFile, OnCallCreateModelResult } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';

/**
 * Directive that passes the upload result to a StorageFileDocumentStore to initialize the document immediately.
 *
 * Use with a DbxAction instance.
 */
@Directive({
  selector: '[dbxFirebaseStorageFileUploadInitializeDocument]',
  exportAs: 'dbxFirebaseStorageFileUploadInitializeDocument',
  standalone: true
})
export class DbxFirebaseStorageFileUploadInitializeDocumentDirective {
  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);
  readonly storageFileDocumentStore = inject(StorageFileDocumentStore);

  readonly initializeWithExpediteProcessing = input<Maybe<boolean>>();

  private readonly source: DbxActionContextStoreSourceInstance<FirebaseStorageAccessorFile, OnCallCreateModelResult> = inject(DbxActionContextStoreSourceInstance<FirebaseStorageAccessorFile, OnCallCreateModelResult>, { host: true });
  private readonly _dbxActionHandlerInstance = clean(new DbxActionHandlerInstance<FirebaseStorageAccessorFile, OnCallCreateModelResult>(this.source));

  constructor() {
    // set the trigger
    cleanSubscription(
      this.uploadStore.uploadResult$.subscribe(async (result) => {
        const successFileResult = result.successFileResults.find((x) => x.fileRef != null);
        const fileRef = successFileResult?.fileRef;

        if (fileRef) {
          this.source.triggerWithValue(fileRef);
        }
      })
    );

    // set the handler function
    this._dbxActionHandlerInstance.setHandlerFunction((fileRef, context) => {
      context.startWorkingWithLoadingStateObservable(
        this.storageFileDocumentStore.initializeStorageFileFromUpload({
          pathString: fileRef.storagePath.pathString,
          bucketId: fileRef.storagePath.bucketId,
          expediteProcessing: this.initializeWithExpediteProcessing() ?? undefined
        })
      );
    });

    this._dbxActionHandlerInstance.init();
  }
}
