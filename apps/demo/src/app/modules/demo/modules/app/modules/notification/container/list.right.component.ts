import { OnDestroy, Component, inject } from '@angular/core';
import { loadingStateContext, loadingStateFromObs } from '@dereekb/rxjs';
import { GuestbookDocumentStore } from '@dereekb/demo-components';
import { DbxFirebaseNotificationItemStore } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './list.right.component.html'
})
export class DemoNotificationListPageRightComponent implements OnDestroy {
  readonly dbxFirebaseNotificationItemStore = inject(DbxFirebaseNotificationItemStore);

  readonly selectedItem$ = this.dbxFirebaseNotificationItemStore.selectedItem$;

  readonly context = loadingStateContext({ obs: loadingStateFromObs(this.dbxFirebaseNotificationItemStore.selectedItem$) });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
