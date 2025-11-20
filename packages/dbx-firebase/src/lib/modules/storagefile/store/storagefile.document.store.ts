import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCreateFunction, firebaseDocumentStoreCrudFunction, firebaseDocumentStoreDeleteFunction, firebaseDocumentStoreReadFunction, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';
import { StorageFile, StorageFileDocument, StorageFileFirestoreCollections, StorageFileFunctions } from '@dereekb/firebase';

@Injectable()
export class StorageFileDocumentStore extends AbstractDbxFirebaseDocumentStore<StorageFile, StorageFileDocument> {
  readonly storageFileFunctions = inject(StorageFileFunctions);

  constructor() {
    super({ firestoreCollection: inject(StorageFileFirestoreCollections).storageFileCollection });
  }

  readonly createStorageFileFromUpload = firebaseDocumentStoreCreateFunction(this, this.storageFileFunctions.storageFile.createStorageFile.create);
  readonly initializeStorageFileFromUpload = firebaseDocumentStoreCreateFunction(this, this.storageFileFunctions.storageFile.createStorageFile.fromUpload);
  readonly initializeAllStorageFilesFromUpload = firebaseDocumentStoreCrudFunction(this.storageFileFunctions.storageFile.createStorageFile.allFromUpload);

  readonly updateStorageFile = firebaseDocumentStoreUpdateFunction(this, this.storageFileFunctions.storageFile.updateStorageFile.update);
  readonly processStorageFile = firebaseDocumentStoreUpdateFunction(this, this.storageFileFunctions.storageFile.updateStorageFile.process);

  readonly deleteStorageFile = firebaseDocumentStoreDeleteFunction(this, this.storageFileFunctions.storageFile.deleteStorageFile.delete);

  readonly downloadStorageFile = firebaseDocumentStoreReadFunction(this, this.storageFileFunctions.storageFile.readStorageFile.download);
}
