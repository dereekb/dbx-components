import { ChangeDetectionStrategy, type OnDestroy, Component, inject } from '@angular/core';
import { loadingStateContext, loadingStateFromObs } from '@dereekb/rxjs';
import { DbxFirebaseNotificationItemStore, DbxFirebaseNotificationItemViewComponent } from '@dereekb/dbx-firebase';
import { DbxContentContainerDirective, DbxLoadingComponent, DbxTwoColumnRightComponent } from '@dereekb/dbx-web';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  templateUrl: './list.right.component.html',
  imports: [DbxTwoColumnRightComponent, DbxFirebaseNotificationItemViewComponent, DbxLoadingComponent, DbxContentContainerDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoNotificationListPageRightComponent implements OnDestroy {
  readonly dbxFirebaseNotificationItemStore = inject(DbxFirebaseNotificationItemStore);

  readonly selectedItem$ = this.dbxFirebaseNotificationItemStore.selectedItem$;
  readonly selectedItemSignal = toSignal(this.selectedItem$);

  readonly context = loadingStateContext({ obs: loadingStateFromObs(this.dbxFirebaseNotificationItemStore.selectedItem$) });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
