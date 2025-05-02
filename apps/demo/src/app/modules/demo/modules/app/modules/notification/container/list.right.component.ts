import { OnDestroy, Component, inject } from '@angular/core';
import { loadingStateContext, loadingStateFromObs } from '@dereekb/rxjs';
import { DbxFirebaseNotificationItemStore, DbxFirebaseNotificationItemViewComponent } from '@dereekb/dbx-firebase';
import { DbxContentContainerDirective, DbxLoadingComponent, DbxTwoColumnRightComponent } from '@dereekb/dbx-web';
import { AsyncPipe } from '@angular/common';

@Component({
  templateUrl: './list.right.component.html',
  imports: [AsyncPipe, DbxTwoColumnRightComponent, DbxFirebaseNotificationItemViewComponent, DbxLoadingComponent, DbxContentContainerDirective],
  standalone: true
})
export class DemoNotificationListPageRightComponent implements OnDestroy {
  readonly dbxFirebaseNotificationItemStore = inject(DbxFirebaseNotificationItemStore);

  readonly selectedItem$ = this.dbxFirebaseNotificationItemStore.selectedItem$;

  readonly context = loadingStateContext({ obs: loadingStateFromObs(this.dbxFirebaseNotificationItemStore.selectedItem$) });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
