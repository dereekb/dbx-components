import { Directive } from '@angular/core';
import { SystemState, SystemStateDocument, SystemStateStoredData } from '@dereekb/firebase';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../modules/store/store.document.directive';
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
