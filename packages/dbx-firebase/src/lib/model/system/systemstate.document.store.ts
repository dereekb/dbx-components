import { inject, Injectable } from '@angular/core';
import { type SystemState, type SystemStateDocument, type SystemStateFirestoreCollection, SystemStateFirestoreCollections, type SystemStateStoredData } from '@dereekb/firebase';
import { AbstractDbxFirebaseDocumentStore } from '../modules/store/store.document';

@Injectable()
export class SystemStateDocumentStore<T extends SystemStateStoredData = SystemStateStoredData> extends AbstractDbxFirebaseDocumentStore<SystemState<T>, SystemStateDocument<T>> {
  constructor() {
    super({ firestoreCollection: inject(SystemStateFirestoreCollections).systemStateCollection as SystemStateFirestoreCollection<T> });
  }
}
