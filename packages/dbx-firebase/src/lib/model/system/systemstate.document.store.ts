import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore } from '@dereekb/dbx-firebase';
import { SystemState, SystemStateDocument, SystemStateFirestoreCollection, SystemStateFirestoreCollections, SystemStateStoredData } from '@dereekb/firebase';

@Injectable()
export class SystemStateDocumentStore<T extends SystemStateStoredData = SystemStateStoredData> extends AbstractDbxFirebaseDocumentStore<SystemState<T>, SystemStateDocument<T>> {
  constructor(readonly collections: SystemStateFirestoreCollections) {
    super({ firestoreCollection: collections.systemStateCollection as SystemStateFirestoreCollection<T> });
  }
}
