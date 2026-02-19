import { Directive } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { StorageFileGroupDocumentStore } from './storagefilegroup.document.store';
import { StorageFileGroup, StorageFileGroupDocument } from '@dereekb/firebase';

@Directive({
  selector: '[dbxFirebaseStorageFileGroupDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseStorageFileGroupDocumentStoreDirective, StorageFileGroupDocumentStore),
  standalone: true
})
export class DbxFirebaseStorageFileGroupDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<StorageFileGroup, StorageFileGroupDocument, StorageFileGroupDocumentStore> {
  constructor(store: StorageFileGroupDocumentStore) {
    super(store);
  }
}
