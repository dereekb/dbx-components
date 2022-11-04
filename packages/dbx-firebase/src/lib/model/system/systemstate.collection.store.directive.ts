import { Directive } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '@dereekb/dbx-firebase';
import { SystemState, SystemStateDocument } from '@dereekb/firebase';
import { SystemStateCollectionStore } from './systemstate.collection.store';

@Directive({
  selector: '[dbxFirebaseSystemStateCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxFirebaseSystemStateCollectionStoreDirective, SystemStateCollectionStore)
})
export class DbxFirebaseSystemStateCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<SystemState, SystemStateDocument, SystemStateCollectionStore> {
  constructor(store: SystemStateCollectionStore) {
    super(store);
  }
}
