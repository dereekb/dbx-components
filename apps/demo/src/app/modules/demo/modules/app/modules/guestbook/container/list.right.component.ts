import { ChangeDetectionStrategy, type OnDestroy, Component, inject } from '@angular/core';
import { DbxTwoColumnRightComponent } from '@dereekb/dbx-web';
import { loadingStateContext } from '@dereekb/rxjs';
import { GuestbookDocumentStore } from 'demo-components';
import { DemoGuestbookViewComponent } from './guestbook.view.component';

/**
 * Right-column page for a single guestbook at `/demo/app/guestbook/:id`.
 *
 * @dbxRouteModel guestbook :id - The guestbook the page is viewing
 * @dbxRouteModel guestbookEntry gb/:id/gbe/{authUid} - The caller's entry in this guestbook
 */
@Component({
  templateUrl: './list.right.component.html',
  imports: [DbxTwoColumnRightComponent, DemoGuestbookViewComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoGuestbookListPageRightComponent implements OnDestroy {
  readonly guestbookStore = inject(GuestbookDocumentStore);

  readonly context = loadingStateContext({ obs: this.guestbookStore.dataLoadingState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
