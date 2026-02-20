import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective } from './store.document.directive';
import { DbxFirebaseDocumentStoreTwoWayKeyProvider } from './store.document.twoway.key.source';
import { cleanSubscription } from '@dereekb/dbx-core';

/**
 * Used for providing an id from the twoWayFlatKey$ from a DbxFirebaseDocumentStoreTwoWayKeyProvider.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreIdFromTwoWayModelKey]',
  standalone: true
})
export class DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective {
  readonly dbxFirebaseDocumentStoreDirective = inject(DbxFirebaseDocumentStoreDirective, { host: true });
  readonly dbxFirebaseDocumentStoreTwoWayKeyProvider = inject(DbxFirebaseDocumentStoreTwoWayKeyProvider, { skipSelf: true, host: false });

  constructor() {
    cleanSubscription(this.dbxFirebaseDocumentStoreDirective.store.setId(this.dbxFirebaseDocumentStoreTwoWayKeyProvider.twoWayFlatKey$));
  }
}
