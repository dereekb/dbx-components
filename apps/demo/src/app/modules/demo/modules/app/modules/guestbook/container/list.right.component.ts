import { OnDestroy, Component } from '@angular/core';
import { loadingStateContext } from '@dereekb/rxjs';
import { GuestbookDocumentStore } from '@dereekb/demo-components';

@Component({
  templateUrl: './list.right.component.html'
})
export class DemoGuestbookListPageRightComponent implements OnDestroy {
  readonly context = loadingStateContext({ obs: this.guestbookStore.dataLoadingState$ });

  constructor(readonly guestbookStore: GuestbookDocumentStore) {}

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
