import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '../../../model/modules/store';
import { StorageFileFirestoreCollections, StorageFile, StorageFileDocument } from '@dereekb/firebase';

@Injectable()
export class StorageFileCollectionStore extends AbstractDbxFirebaseCollectionStore<StorageFile, StorageFileDocument> {
  constructor(collections: StorageFileFirestoreCollections) {
    super({ firestoreCollection: collections.storageFileCollection });
  }
}
