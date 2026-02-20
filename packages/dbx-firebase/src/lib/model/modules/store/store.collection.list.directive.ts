import { cleanSubscription } from '@dereekb/dbx-core';
import { DbxListViewWrapper } from '@dereekb/dbx-web';
import { Directive, inject } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective } from './store.collection.directive';

/**
 * Directive that connects a host DbxListView to a DbxFirebaseCollectionStoreDirective to pass data for rendering items from a collection and query parameters.
 */
@Directive({
  selector: '[dbxFirebaseCollectionList]',
  standalone: true
})
export class DbxFirebaseCollectionListDirective<T> {
  readonly dbxFirebaseCollectionStoreDirective = inject(DbxFirebaseCollectionStoreDirective<T>);
  readonly dbxListViewWrapper = inject(DbxListViewWrapper<T>, { host: true });

  constructor() {
    this.dbxListViewWrapper.setState(this.dbxFirebaseCollectionStoreDirective.pageLoadingState$);

    if (this.dbxListViewWrapper.loadMore) {
      cleanSubscription(
        this.dbxListViewWrapper.loadMore.subscribe(() => {
          this.dbxFirebaseCollectionStoreDirective.next();
        })
      );
    }
  }
}
