import { DbxActionLoadingContextDirective, DbxActionModule, DbxActionSnackbarErrorDirective, DbxFileUploadComponent, DbxFileUploadActionSyncDirective, DbxLoadingComponent } from '@dereekb/dbx-web';
import { DbxFirebaseStorageFileUploadActionHandlerDirective, DbxFirebaseStorageFileUploadStoreDirective, DbxFirebaseStorageFileUploadSyncDirective, DbxFirebaseStorageFileUploadInitializeDocumentDirective } from './container';
import { NgModule } from '@angular/core';
import { DbxFirebaseStorageFileDocumentStoreDirective } from './store/storagefile.document.store.directive';
import { DbxFirebaseStorageFileCollectionStoreDirective } from './store';

export const importsAndExports = [
  // dbx-core/dbx-web modules/components
  DbxActionModule,
  DbxLoadingComponent,
  DbxActionLoadingContextDirective,
  DbxActionSnackbarErrorDirective,
  DbxFileUploadComponent,
  DbxFileUploadActionSyncDirective,
  // containers
  DbxFirebaseStorageFileUploadActionHandlerDirective,
  DbxFirebaseStorageFileUploadStoreDirective,
  DbxFirebaseStorageFileUploadSyncDirective,
  DbxFirebaseStorageFileUploadInitializeDocumentDirective,
  // stores
  DbxFirebaseStorageFileCollectionStoreDirective,
  DbxFirebaseStorageFileDocumentStoreDirective
];

/**
 * Convenience module for importing various modules/components that are relevant to the storage file upload feature.
 *
 * - DbxActionModule
 * - DbxFileUploadComponent
 * - DbxFirebaseStorageFileUploadActionHandlerDirective
 * - DbxFirebaseStorageFileUploadStoreDirective
 * - DbxFirebaseStorageFileUploadSyncDirective
 * - DbxFirebaseStorageFileUploadInitializeDocumentDirective
 * - DbxFirebaseStorageFileUploadStore
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFirebaseStorageFileUploadModule {}
