import { NgModule } from '@angular/core';
import { DbxFirebaseStorageFileUploadModule } from '../storagefile/storagefile.upload.module';
import {
  DbxFirebaseFormSpaceListComponent,
  DbxFirebaseFormSpaceSectionComponent,
  DbxFirebaseFormSpaceSlotUploadComponent,
  DbxFirebaseFormSpaceSlotUploadDirective,
  DbxFirebaseFormSpaceStepBlockComponent,
  DbxFirebaseFormSpaceSubmitButtonComponent,
  DbxFirebaseFormSpaceUploadInitializeDocumentsDirective
} from './container';
import { DbxFirebaseFormSpaceCollectionStoreDirective, DbxFirebaseFormSpaceDocumentStoreDirective } from './store';

const IMPORTS_AND_EXPORTS = [
  // the FormSpace upload chain IS the StorageFile upload chain with a FormSpace-shaped path, so a page
  // importing this one should not have to remember to import both
  DbxFirebaseStorageFileUploadModule,
  // containers
  DbxFirebaseFormSpaceListComponent,
  DbxFirebaseFormSpaceSectionComponent,
  DbxFirebaseFormSpaceSlotUploadComponent,
  DbxFirebaseFormSpaceSlotUploadDirective,
  DbxFirebaseFormSpaceStepBlockComponent,
  DbxFirebaseFormSpaceSubmitButtonComponent,
  DbxFirebaseFormSpaceUploadInitializeDocumentsDirective,
  // stores
  DbxFirebaseFormSpaceCollectionStoreDirective,
  DbxFirebaseFormSpaceDocumentStoreDirective
];

/**
 * Convenience module for the FormSpace feature: the document/collection store directives, the slot upload
 * handler, the multi-file initializer, the step-block section and submit button, the owner's space listing,
 * and the whole StorageFile upload chain they build on.
 *
 * The section and the submit button additionally want the app's type registry, which is an APP-level
 * provider rather than a module import — see `provideDbxFirebaseFormSpaceTypeConfigService()`.
 */
@NgModule({
  imports: IMPORTS_AND_EXPORTS,
  exports: IMPORTS_AND_EXPORTS
})
export class DbxFirebaseFormSpaceModule {}
