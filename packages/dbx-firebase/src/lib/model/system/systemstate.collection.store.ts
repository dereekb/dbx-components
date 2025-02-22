import { Injectable } from '@angular/core';
import { SystemState, SystemStateDocument, SystemStateFirestoreCollections } from '@dereekb/firebase';
import { AbstractDbxFirebaseCollectionStore } from '../modules/store/store.collection';

@Injectable()
export class SystemStateCollectionStore extends AbstractDbxFirebaseCollectionStore<SystemState, SystemStateDocument> {
  constructor(collections: SystemStateFirestoreCollections) {
    super({ firestoreCollection: collections.systemStateCollection });
  }
}
