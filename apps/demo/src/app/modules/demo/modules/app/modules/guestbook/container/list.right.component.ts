import { OnDestroy, Component, inject } from '@angular/core';
import { loadingStateContext } from '@dereekb/rxjs';
import { GuestbookDocumentStore } from 'demo-components';

@Component({
  templateUrl: './list.right.component.html'
})
export class DemoGuestbookListPageRightComponent implements OnDestroy {
  readonly guestbookStore = inject(GuestbookDocumentStore);

  readonly context = loadingStateContext({ obs: this.guestbookStore.dataLoadingState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
