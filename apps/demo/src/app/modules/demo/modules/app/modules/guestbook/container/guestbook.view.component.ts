import { Component, OnDestroy, ViewChild, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { loadingStateContext } from '@dereekb/rxjs';
import { map } from 'rxjs';
import { DemoGuestbookEntryCollectionStoreDirective, DemoGuestbookEntryDocumentStoreDirective, DemoGuestbookEntryListComponent, GuestbookDocumentStore, GuestbookEntryDocumentStore } from 'demo-components';
import { DemoGuestbookEntryPopupComponent } from './guestbook.entry.popup.component';
import { DbxButtonModule, DbxContentContainerDirective, DbxListEmptyContentComponent, DbxLoadingModule, DbxTwoBlockComponent } from '@dereekb/dbx-web';
import { DbxRouteModelIdFromAuthUserIdDirective } from '@dereekb/dbx-core';
import { AsyncPipe, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { DbxFirebaseCollectionListDirective } from '@dereekb/dbx-firebase';
import { publishedGuestbookEntry } from 'demo-firebase';

@Component({
  selector: 'demo-guestbook-view',
  templateUrl: './guestbook.view.component.html',
  imports: [AsyncPipe, NgIf, NgSwitch, NgSwitchCase, DbxLoadingModule, DbxContentContainerDirective, DbxTwoBlockComponent, DemoGuestbookEntryDocumentStoreDirective, DbxRouteModelIdFromAuthUserIdDirective, DbxButtonModule, DbxListEmptyContentComponent, DemoGuestbookEntryListComponent, DemoGuestbookEntryCollectionStoreDirective, DbxFirebaseCollectionListDirective, MatDividerModule],
  standalone: true
})
export class DemoGuestbookViewComponent implements OnDestroy {
  readonly guestbookStore = inject(GuestbookDocumentStore);
  readonly matDialog = inject(MatDialog);

  readonly entryConstraints = publishedGuestbookEntry();

  @ViewChild(GuestbookEntryDocumentStore)
  readonly documentStore!: GuestbookEntryDocumentStore;

  readonly context = loadingStateContext({ obs: this.guestbookStore.dataLoadingState$ });
  readonly data$ = this.guestbookStore.data$;

  readonly name$ = this.data$.pipe(map((x) => x?.name));

  ngOnDestroy(): void {
    this.context.destroy();
  }

  openEntry() {
    DemoGuestbookEntryPopupComponent.openPopup(this.matDialog, {
      guestbookEntryDocumentStore: this.documentStore
    });
  }
}
