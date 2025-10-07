import { Directive } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { StorageFileDocumentStore } from './storagefile.document.store';
import { StorageFile, StorageFileDocument } from '@dereekb/firebase';

@Directive({
  selector: '[dbxFirebaseStorageFileDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseStorageFileDocumentStoreDirective, StorageFileDocumentStore),
  standalone: true
})
export class DbxFirebaseStorageFileDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<StorageFile, StorageFileDocument, StorageFileDocumentStore> {
  constructor(store: StorageFileDocumentStore) {
    super(store);
  }
}
