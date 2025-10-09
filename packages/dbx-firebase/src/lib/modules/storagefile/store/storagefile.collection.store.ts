import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore, firebaseCollectionStoreCreateFunction } from '../../../model/modules/store';
import { StorageFileFirestoreCollections, StorageFile, StorageFileDocument } from '@dereekb/firebase';
import { StorageFileFunctions } from '@dereekb/firebase';
import { inject } from '@angular/core';

@Injectable()
export class StorageFileCollectionStore extends AbstractDbxFirebaseCollectionStore<StorageFile, StorageFileDocument> {
  readonly storageFileFunctions = inject(StorageFileFunctions);

  constructor(collections: StorageFileFirestoreCollections) {
    super({ firestoreCollection: collections.storageFileCollection });
  }

  readonly initializeAllStorageFilesFromUpload = firebaseCollectionStoreCreateFunction(this, this.storageFileFunctions.storageFile.createStorageFile.allFromUpload);
}
