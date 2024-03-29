import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxListViewWrapper } from '@dereekb/dbx-web';
import { Directive, Host, OnInit } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective } from './store.collection.directive';

/**
 * Directive that connects a host DbxListView to a DbxFirebaseCollectionStoreDirective to pass data for rendering items from a collection and query parameters.
 */
@Directive({
  selector: '[dbxFirebaseCollectionList]'
})
export class DbxFirebaseCollectionListDirective<T> extends AbstractSubscriptionDirective implements OnInit {
  constructor(readonly dbxFirebaseCollectionStoreDirective: DbxFirebaseCollectionStoreDirective<T>, @Host() readonly dbxListViewWrapper: DbxListViewWrapper<T>) {
    super();
    this.dbxListViewWrapper.state$ = this.dbxFirebaseCollectionStoreDirective.pageLoadingState$;
  }

  ngOnInit(): void {
    this.sub = this.dbxListViewWrapper.loadMore?.subscribe(() => {
      this.dbxFirebaseCollectionStoreDirective.next();
    });
  }
}
