import { Directive, inject } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '../../../model/modules/store';
import { StorageFileCollectionStore } from './storagefile.collection.store';
import { type StorageFile, type StorageFileDocument } from '@dereekb/firebase';

@Directive({
  selector: '[dbxFirebaseStorageFileCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxFirebaseStorageFileCollectionStoreDirective, StorageFileCollectionStore),
  standalone: true
})
export class DbxFirebaseStorageFileCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<StorageFile, StorageFileDocument, StorageFileCollectionStore> {
  constructor() {
    super(inject(StorageFileCollectionStore));
    this.setConstraints([]);
  }
}
