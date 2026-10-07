import { Component, type OnDestroy, inject, viewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { loadingStateContext } from '@dereekb/rxjs';
import { map } from 'rxjs';
import { DemoGuestbookEntryCollectionStoreDirective, DemoGuestbookEntryDocumentStoreDirective, DemoGuestbookEntryListComponent, GuestbookDocumentStore, GuestbookEntryDocumentStore } from 'demo-components';
import { DemoGuestbookAlbumComponent } from './guestbook.album.component';
import { DemoGuestbookEntryPopupComponent } from './guestbook.entry.popup.component';
import { DbxButtonModule, DbxContentContainerDirective, DbxListEmptyContentComponent, DbxLoadingModule, DbxTwoBlockComponent } from '@dereekb/dbx-web';
import { DbxRouteModelIdFromAuthUserIdDirective } from '@dereekb/dbx-core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDividerModule } from '@angular/material/divider';
import { DbxFirebaseCollectionListDirective, type DbxFirebaseNotificationUserSettingsComponentConfig, DbxFirebaseNotificationUserSettingsDialogButtonComponent } from '@dereekb/dbx-firebase';
import { DEMO_NOTIFICATION_GUESTBOOK_SETTINGS_GROUP, publishedGuestbookEntriesQuery } from 'demo-firebase';

@Component({
  selector: 'app-guestbook-view',
  templateUrl: './guestbook.view.component.html',
  imports: [
    AsyncPipe,
    DbxLoadingModule,
    DbxContentContainerDirective,
    DbxTwoBlockComponent,
    DemoGuestbookEntryDocumentStoreDirective,
    DbxRouteModelIdFromAuthUserIdDirective,
    DbxButtonModule,
    DbxListEmptyContentComponent,
    DemoGuestbookEntryListComponent,
    DemoGuestbookEntryCollectionStoreDirective,
    DbxFirebaseCollectionListDirective,
    MatDividerModule,
    DemoGuestbookAlbumComponent,
    DbxFirebaseNotificationUserSettingsDialogButtonComponent
  ]
})
export class DemoGuestbookViewComponent implements OnDestroy {
  readonly guestbookStore = inject(GuestbookDocumentStore);
  readonly matDialog = inject(MatDialog);

  readonly entryConstraints = publishedGuestbookEntriesQuery({ published: true });

  // only the guestbook notifications, without the account-wide delivery settings
  readonly guestbookNotificationSettingsConfig: DbxFirebaseNotificationUserSettingsComponentConfig = { groups: [DEMO_NOTIFICATION_GUESTBOOK_SETTINGS_GROUP.key], showDeliveryMethodSettings: false };

  readonly documentStore = viewChild.required(GuestbookEntryDocumentStore);

  readonly context = loadingStateContext({ obs: this.guestbookStore.dataLoadingState$ });
  readonly data$ = this.guestbookStore.data$;

  readonly name$ = this.data$.pipe(map((x) => x?.name));
  readonly nameSignal = toSignal(this.name$);

  ngOnDestroy(): void {
    this.context.destroy();
  }

  openEntry() {
    DemoGuestbookEntryPopupComponent.openPopup(this.matDialog, {
      guestbookEntryDocumentStore: this.documentStore()
    });
  }
}
