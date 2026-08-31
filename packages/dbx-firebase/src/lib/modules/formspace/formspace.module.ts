import { NgModule } from '@angular/core';
import { DbxFirebaseStorageFileUploadModule } from '../storagefile/storagefile.upload.module';
import { DbxFirebaseFormSpaceSlotUploadDirective, DbxFirebaseFormSpaceUploadInitializeDocumentsDirective } from './container';
import { DbxFirebaseFormSpaceCollectionStoreDirective, DbxFirebaseFormSpaceDocumentStoreDirective } from './store';

const IMPORTS_AND_EXPORTS = [
  // the FormSpace upload chain IS the StorageFile upload chain with a FormSpace-shaped path, so a page
  // importing this one should not have to remember to import both
  DbxFirebaseStorageFileUploadModule,
  // containers
  DbxFirebaseFormSpaceSlotUploadDirective,
  DbxFirebaseFormSpaceUploadInitializeDocumentsDirective,
  // stores
  DbxFirebaseFormSpaceCollectionStoreDirective,
  DbxFirebaseFormSpaceDocumentStoreDirective
];

/**
 * Convenience module for the FormSpace feature: the document/collection store directives, the slot upload
 * handler, the multi-file initializer, and the whole StorageFile upload chain they build on.
 */
@NgModule({
  imports: IMPORTS_AND_EXPORTS,
  exports: IMPORTS_AND_EXPORTS
})
export class DbxFirebaseFormSpaceModule {}
