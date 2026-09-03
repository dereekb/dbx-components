import { Directive, inject, input } from '@angular/core';
import { DbxActionContextStoreSourceInstance, DbxActionHandlerInstance, clean, cleanSubscription } from '@dereekb/dbx-core';
import { type FirebaseStorageAccessorFile, type OnCallCreateModelResult, StorageFileFunctions } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseStorageFileUploadStore } from '../../storagefile/store';

/**
 * Directive that initializes EVERY file of an upload result, rather than only the first.
 *
 * The single-document counterpart, `dbxFirebaseStorageFileUploadInitializeDocument`, takes
 * `successFileResults.find(...)` and initializes that one file — correct for a slot that holds one file,
 * and silently lossy for a FOLDER slot, where three of four uploads would sit in the uploads folder until
 * the next scheduled sweep picked them up.
 *
 * Goes through the `fromUpload` callable directly instead of a StorageFileDocumentStore: a folder upload
 * produces several documents and there is no single one for a store to hold, and the FormSpace's own `f`
 * array — which the initializer rewrites — is what the page renders from anyway.
 *
 * Use with a DbxAction instance.
 */
@Directive({
  selector: '[dbxFirebaseFormSpaceUploadInitializeDocuments]',
  exportAs: 'dbxFirebaseFormSpaceUploadInitializeDocuments'
})
export class DbxFirebaseFormSpaceUploadInitializeDocumentsDirective {
  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);
  readonly storageFileFunctions = inject(StorageFileFunctions);

  /**
   * Whether to run each initialized file's processing immediately rather than waiting for the queue.
   */
  readonly initializeWithExpediteProcessing = input<Maybe<boolean>>();

  private readonly source: DbxActionContextStoreSourceInstance<FirebaseStorageAccessorFile[], OnCallCreateModelResult[]> = inject(DbxActionContextStoreSourceInstance<FirebaseStorageAccessorFile[], OnCallCreateModelResult[]>, { host: true });
  private readonly _dbxActionHandlerInstance = clean(new DbxActionHandlerInstance<FirebaseStorageAccessorFile[], OnCallCreateModelResult[]>(this.source));

  constructor() {
    cleanSubscription(
      this.uploadStore.uploadResult$.subscribe((result) => {
        const fileRefs = result.successFileResults.map((x) => x.fileRef).filter((x): x is FirebaseStorageAccessorFile => x != null);

        if (fileRefs.length > 0) {
          this.source.triggerWithValue(fileRefs);
        }
      })
    );

    this._dbxActionHandlerInstance.setHandlerFunction((fileRefs, context) => {
      const expediteProcessing = this.initializeWithExpediteProcessing() ?? undefined;

      // SEQUENTIAL, not Promise.all: every file in a slot contends on the same FormSpace document — the
      // claim transaction bumps `fi` and the register transaction bumps `uc` — so initializing four at once
      // only buys transaction retries.
      context.startWorkingWithPromise(
        fileRefs.reduce(
          async (previous, fileRef) => {
            const results = await previous;

            const result = await this.storageFileFunctions.storageFile.createStorageFile.fromUpload({
              pathString: fileRef.storagePath.pathString,
              bucketId: fileRef.storagePath.bucketId,
              expediteProcessing
            });

            return [...results, result];
          },
          Promise.resolve([] as OnCallCreateModelResult[])
        )
      );
    });

    this._dbxActionHandlerInstance.init();
  }
}
