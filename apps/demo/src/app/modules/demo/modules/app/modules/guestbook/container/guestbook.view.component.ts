import { Component, OnDestroy, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { loadingStateContext } from '@dereekb/rxjs';
import { map } from 'rxjs';
import { GuestbookDocumentStore } from '../../../../shared/modules/guestbook/store/guestbook.document.store';
import { GuestbookEntryDocumentStore } from '../../../../shared/modules/guestbook/store/guestbook.entry.document.store';
import { DemoGuestbookEntryPopupComponent } from './guestbook.entry.popup.component';

@Component({
  selector: 'demo-guestbook-view',
  templateUrl: './guestbook.view.component.html'
})
export class DemoGuestbookViewComponent implements OnDestroy {

  @ViewChild(GuestbookEntryDocumentStore)
  readonly documentStore!: GuestbookEntryDocumentStore;

  readonly context = loadingStateContext({ obs: this.guestbookStore.dataLoadingState$ });
  readonly data$ = this.guestbookStore.data$;

  readonly name$ = this.data$.pipe(map(x => x?.name));

  constructor(readonly guestbookStore: GuestbookDocumentStore, readonly matDialog: MatDialog) { }

  ngOnDestroy(): void {
    this.context.destroy();
  }

  openEntry() {
    DemoGuestbookEntryPopupComponent.openPopup(this.matDialog, {
      guestbookEntryDocumentStore: this.documentStore
    });
  }

}
