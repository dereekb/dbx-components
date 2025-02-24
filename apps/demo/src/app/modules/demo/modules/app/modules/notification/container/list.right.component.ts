import { OnDestroy, Component, inject } from '@angular/core';
import { loadingStateContext } from '@dereekb/rxjs';
import { GuestbookDocumentStore } from '@dereekb/demo-components';

@Component({
  templateUrl: './list.right.component.html'
})
export class DemoNotificationListPageRightComponent implements OnDestroy {
  readonly notificationStore = inject(GuestbookDocumentStore);

  readonly context = loadingStateContext({ obs: this.notificationStore.dataLoadingState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
