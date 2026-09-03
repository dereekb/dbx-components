import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { StorageFileDocumentStore } from './storagefile.document.store';
import { type StorageFile, type StorageFileDocument } from '@dereekb/firebase';

@Directive({
  selector: '[dbxFirebaseStorageFileDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseStorageFileDocumentStoreDirective, StorageFileDocumentStore)
})
export class DbxFirebaseStorageFileDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<StorageFile, StorageFileDocument, StorageFileDocumentStore> {
  constructor() {
    super(inject(StorageFileDocumentStore));
  }
}
