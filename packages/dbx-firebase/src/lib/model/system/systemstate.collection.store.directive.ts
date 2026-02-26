import { Directive, inject } from '@angular/core';
import { SystemState, SystemStateDocument } from '@dereekb/firebase';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '../modules/store/store.collection.directive';
import { SystemStateCollectionStore } from './systemstate.collection.store';

@Directive({
  selector: '[dbxFirebaseSystemStateCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxFirebaseSystemStateCollectionStoreDirective, SystemStateCollectionStore)
})
export class DbxFirebaseSystemStateCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<SystemState, SystemStateDocument, SystemStateCollectionStore> {
  constructor() {
    super(inject(SystemStateCollectionStore));
  }
}
