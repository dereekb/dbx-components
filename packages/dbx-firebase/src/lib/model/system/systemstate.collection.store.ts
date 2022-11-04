import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';
import { SystemState, SystemStateDocument, SystemStateFirestoreCollections } from '@dereekb/firebase';

@Injectable()
export class SystemStateCollectionStore extends AbstractDbxFirebaseCollectionStore<SystemState, SystemStateDocument> {
  constructor(readonly collections: SystemStateFirestoreCollections) {
    super({ firestoreCollection: collections.systemStateCollection });
  }
}
