import { Directive, inject } from '@angular/core';
import { first, switchMap } from 'rxjs';
import { DbxButton, cleanSubscription } from '@dereekb/dbx-core';
import { DbxPdfMergeEditorStore, PDF_MERGE_RESULT_MIME_TYPE } from '@dereekb/dbx-web';
import { DbxFirebaseStorageFileUploadStore } from '../store';

/**
 * Merged document file name used for the {@link File} wrapped around the merge editor's output blob.
 */
export const DBX_FIREBASE_STORAGE_PDF_MERGE_UPLOAD_FILE_NAME = 'merged-document.pdf';

/**
 * Syncs a {@link DbxPdfMergeEditorStore}'s merged output into a {@link DbxFirebaseStorageFileUploadStore}.
 *
 * Apply alongside `[dbxPdfMergeUploadButton]` on the same `<dbx-button>`: the button opens the merge
 * dialog and, because {@link DbxButton.clicked$} only emits after the button's interceptor resolves
 * `true` (i.e. the user confirmed the dialog), each `clicked$` emission is a confirmed merge. On that
 * signal the directive reads the latest `mergeOutput$` blob, wraps it as a single-page-named
 * {@link File}, and calls `setRawFiles([file])` -- driving the rest of the upload pipeline
 * (`dbxFirebaseStorageFileUploadActionHandler` + `dbxFirebaseStorageFileUploadInitializeDocument`)
 * exactly as the file picker did via {@link DbxFirebaseStorageFileUploadSyncDirective}.
 *
 * @example
 * ```html
 * <ng-container dbxFirebaseStorageFileUploadStore>
 *   <ng-container dbxAction dbxFirebaseStorageFileDocument dbxFirebaseStorageFileUploadInitializeDocument [initializeWithExpediteProcessing]="true"></ng-container>
 *   <dbx-action dbxActionSnackbarError [dbxFirebaseStorageFileUploadActionHandler]="handler" [triggerOnFiles]="true">
 *     <ng-container dbxPdfMergeEditorStore [config]="mergeConfig">
 *       <dbx-button dbxFileUploadActionSync [dbxPdfMergeUploadButton]="buttonConfig" dbxFirebaseStoragePdfMergeUploadSync></dbx-button>
 *     </ng-container>
 *   </dbx-action>
 * </ng-container>
 * ```
 */
@Directive({
  selector: '[dbxFirebaseStoragePdfMergeUploadSync]',
  standalone: true
})
export class DbxFirebaseStoragePdfMergeUploadSyncDirective {
  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);
  readonly mergeStore = inject(DbxPdfMergeEditorStore);
  readonly button = inject(DbxButton, { host: true });

  constructor() {
    cleanSubscription(
      this.button.clicked$.pipe(switchMap(() => this.mergeStore.mergeOutput$.pipe(first()))).subscribe((blob) => {
        const file = new File([blob], DBX_FIREBASE_STORAGE_PDF_MERGE_UPLOAD_FILE_NAME, { type: PDF_MERGE_RESULT_MIME_TYPE });
        this.uploadStore.setRawFiles([file]);
      })
    );
  }
}
