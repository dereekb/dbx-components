import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCrudFunction, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';
import { StorageFileGroup, StorageFileGroupDocument, StorageFileFirestoreCollections, StorageFileFunctions } from '@dereekb/firebase';

@Injectable()
export class StorageFileGroupDocumentStore extends AbstractDbxFirebaseDocumentStore<StorageFileGroup, StorageFileGroupDocument> {
  readonly storageFileFunctions = inject(StorageFileFunctions);

  constructor() {
    super({ firestoreCollection: inject(StorageFileFirestoreCollections).storageFileGroupCollection });
  }

  readonly updateStorageFileGroup = firebaseDocumentStoreUpdateFunction(this, this.storageFileFunctions.storageFileGroup.updateStorageFileGroup.update);
  readonly regenerateStorageFileGroupContent = firebaseDocumentStoreCrudFunction(this.storageFileFunctions.storageFileGroup.updateStorageFileGroup.regenerateContent);
}
