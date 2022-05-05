import { Component, OnDestroy } from '@angular/core';
import { loadingStateContext } from '@dereekb/rxjs';
import { map } from 'rxjs';
import { GuestbookDocumentStore } from '../../../../shared/modules/guestbook/store/guestbook.document.store';

@Component({
  selector: 'demo-guestbook-view',
  templateUrl: './guestbook.view.component.html'
})
export class DemoGuestbookViewComponent implements OnDestroy {

  readonly context = loadingStateContext({ obs: this.guestbookStore.dataLoadingState$ });
  readonly data$ = this.guestbookStore.data$;

  readonly name$ = this.data$.pipe(map(x => x?.name));

  constructor(readonly guestbookStore: GuestbookDocumentStore) { }

  ngOnDestroy(): void {
    this.context.destroy();
  }

}
