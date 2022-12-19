import { DbxListViewWrapper } from '@dereekb/dbx-web';
import { Directive, Host } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective } from './store.collection.directive';

/**
 * Directive that connects a host DbxListView to a DbxFirebaseCollectionStoreDirective to pass data for rendering items from a collection and query parameters.
 */
@Directive({
  selector: '[dbxFirebaseCollectionList]'
})
export class DbxFirebaseCollectionListDirective<T> {
  constructor(readonly dbxFirebaseCollectionStoreDirective: DbxFirebaseCollectionStoreDirective<T>, @Host() readonly dbxListViewWrapper: DbxListViewWrapper<T>) {
    this.dbxListViewWrapper.state$ = this.dbxFirebaseCollectionStoreDirective.pageLoadingState$;
  }
}
