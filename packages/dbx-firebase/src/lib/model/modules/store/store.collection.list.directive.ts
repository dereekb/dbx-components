import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxListViewWrapper } from '@dereekb/dbx-web';
import { Directive, OnInit, inject } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective } from './store.collection.directive';

/**
 * Directive that connects a host DbxListView to a DbxFirebaseCollectionStoreDirective to pass data for rendering items from a collection and query parameters.
 */
@Directive({
  selector: '[dbxFirebaseCollectionList]'
})
export class DbxFirebaseCollectionListDirective<T> extends AbstractSubscriptionDirective implements OnInit {
  readonly dbxFirebaseCollectionStoreDirective = inject(DbxFirebaseCollectionStoreDirective<T>);
  readonly dbxListViewWrapper = inject(DbxListViewWrapper<T>, { host: true });

  constructor() {
    super();
    this.dbxListViewWrapper.setStateObs(this.dbxFirebaseCollectionStoreDirective.pageLoadingState$);
  }

  ngOnInit(): void {
    this.sub = this.dbxListViewWrapper.loadMore?.subscribe(() => {
      this.dbxFirebaseCollectionStoreDirective.next();
    });
  }
}
