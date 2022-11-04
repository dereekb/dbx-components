import { Directive } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { SystemState, SystemStateDocument, SystemStateStoredData } from '@dereekb/firebase';
import { SystemStateDocumentStore } from './systemstate.document.store';

@Directive({
  selector: '[dbxFirebaseSystemStateDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseSystemStateDocumentStoreDirective, SystemStateDocumentStore)
})
export class DbxFirebaseSystemStateDocumentStoreDirective<T extends SystemStateStoredData = SystemStateStoredData> extends DbxFirebaseDocumentStoreDirective<SystemState<T>, SystemStateDocument<T>, SystemStateDocumentStore<T>> {
  constructor(store: SystemStateDocumentStore<T>) {
    super(store);
  }
}
