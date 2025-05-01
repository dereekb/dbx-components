import { OnDestroy, Component, inject } from '@angular/core';
import { DbxTwoColumnRightComponent } from '@dereekb/dbx-web';
import { loadingStateContext } from '@dereekb/rxjs';
import { GuestbookDocumentStore } from 'demo-components';
import { DemoGuestbookViewComponent } from './guestbook.view.component';

@Component({
  templateUrl: './list.right.component.html',
  imports: [DbxTwoColumnRightComponent, DemoGuestbookViewComponent],
  standalone: true
})
export class DemoGuestbookListPageRightComponent implements OnDestroy {
  readonly guestbookStore = inject(GuestbookDocumentStore);

  readonly context = loadingStateContext({ obs: this.guestbookStore.dataLoadingState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
