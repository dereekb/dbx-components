import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore, firebaseCollectionStoreCreateFunction } from '../../../model/modules/store';
import { StorageFileFirestoreCollections, StorageFile, StorageFileDocument, StorageFileFunctions } from '@dereekb/firebase';

@Injectable()
export class StorageFileCollectionStore extends AbstractDbxFirebaseCollectionStore<StorageFile, StorageFileDocument> {
  readonly storageFileFunctions = inject(StorageFileFunctions);

  constructor(collections: StorageFileFirestoreCollections) {
    super({ firestoreCollection: collections.storageFileCollection });
  }

  readonly initializeAllStorageFilesFromUpload = firebaseCollectionStoreCreateFunction(this, this.storageFileFunctions.storageFile.createStorageFile.allFromUpload);
}
