import { Directive, OnInit, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective } from './store.document.directive';
import { DbxFirebaseDocumentStoreTwoWayKeyProvider } from './store.document.twoway.key.source';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { tapLog } from '@dereekb/rxjs';

/**
 * Used for providing an id from the twoWayFlatKey$ from a DbxFirebaseDocumentStoreTwoWayKeyProvider.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreIdFromTwoWayModelKey]'
})
export class DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective extends AbstractSubscriptionDirective implements OnInit {
  readonly dbxFirebaseDocumentStoreDirective = inject(DbxFirebaseDocumentStoreDirective, { host: true });
  readonly dbxFirebaseDocumentStoreTwoWayKeyProvider = inject(DbxFirebaseDocumentStoreTwoWayKeyProvider, { skipSelf: true, host: false });

  ngOnInit(): void {
    this.sub = this.dbxFirebaseDocumentStoreDirective.store.setId(this.dbxFirebaseDocumentStoreTwoWayKeyProvider.twoWayFlatKey$);
  }
}
