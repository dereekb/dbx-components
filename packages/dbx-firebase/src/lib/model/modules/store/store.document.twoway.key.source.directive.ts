import { Observable } from 'rxjs';
import { OnDestroy, Directive, Input, OnInit, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective } from './store.document.directive';
import { DbxFirebaseDocumentStoreTwoWayKeyProvider, provideDbxFirebaseDocumentStoreTwoWayKeyProvider } from './store.document.twoway.key.source';

/**
 * Directive that implements DbxFirebaseDocumentStoreTwoWayKeyProvider and passes the twoWayFlatKey from a host DbxFirebaseDocumentStoreDirective.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreTwoWayModelKeySource]',
  providers: provideDbxFirebaseDocumentStoreTwoWayKeyProvider(DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective)
})
export class DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective implements DbxFirebaseDocumentStoreTwoWayKeyProvider {
  readonly dbxFirebaseDocumentStoreDirective = inject(DbxFirebaseDocumentStoreDirective, { host: true });
  readonly twoWayFlatKey$: Observable<string> = this.dbxFirebaseDocumentStoreDirective.twoWayFlatKey$;
}
