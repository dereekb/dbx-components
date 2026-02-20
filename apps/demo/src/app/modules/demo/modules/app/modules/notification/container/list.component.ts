import { AnchorForValueFunction, DbxActionModule, DbxButtonModule, DbxListEmptyContentComponent, DbxListItemAnchorModifierDirective, DbxListModifierModule, DbxTwoBlockComponent, DbxTwoColumnLayoutModule } from '@dereekb/dbx-web';
import { Component, inject } from '@angular/core';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { NotificationItem } from '@dereekb/firebase';
import { DbxRouteModelIdDirective, DbxRouterService, clean, dbxRouteModelIdParamRedirect } from '@dereekb/dbx-core';
import { DbxFirebaseCollectionListDirective, DbxFirebaseModelViewedEventDirective, DbxFirebaseNotificationItemListComponent, DbxFirebaseNotificationItemStore, NotificationSummaryDocumentStore } from '@dereekb/dbx-firebase';
import { distinctUntilChanged, map, of, shareReplay, switchMap } from 'rxjs';
import { LoadingState, WorkUsingContext, catchLoadingStateErrorWithOperator, successResult } from '@dereekb/rxjs';
import { DemoGuestbookCollectionStoreDirective, DemoGuestbookListComponent, ProfileDocumentStore } from 'demo-components';
import { UIView } from '@uirouter/angular';
import { AsyncPipe } from '@angular/common';

@Component({
  templateUrl: './list.component.html',
  imports: [UIView, AsyncPipe, DbxActionModule, DbxTwoBlockComponent, DbxTwoColumnLayoutModule, DbxFirebaseNotificationItemListComponent, DbxButtonModule, DbxListItemAnchorModifierDirective, DbxListEmptyContentComponent, DbxListModifierModule, DemoGuestbookCollectionStoreDirective, DemoGuestbookListComponent, DbxFirebaseCollectionListDirective, DbxRouteModelIdDirective, DbxFirebaseModelViewedEventDirective],
  standalone: true
})
export class DemoNotificationListPageComponent {
  readonly profileDocumentStore = inject(ProfileDocumentStore);

  readonly dbxRouterService = inject(DbxRouterService);
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly dbxFirebaseNotificationItemStore = inject(DbxFirebaseNotificationItemStore);
  readonly notificationSummaryDocumentStore = inject(NotificationSummaryDocumentStore);

  readonly notificationItemsLoadingState$ = this.notificationSummaryDocumentStore.notificationItemsLoadingState$.pipe(catchLoadingStateErrorWithOperator<LoadingState<NotificationItem<any>[]>>(map(() => successResult([]))));

  private readonly _notificationIdInstance = clean(dbxRouteModelIdParamRedirect(this.dbxRouterService));

  readonly reachedTestLimit$ = this.notificationSummaryDocumentStore.exists$.pipe(
    switchMap((exists) => {
      if (exists) {
        return this.notificationSummaryDocumentStore.notificationItems$.pipe(
          map((x) => x.length > 6),
          distinctUntilChanged(),
          shareReplay(1)
        );
      } else {
        return of(false);
      }
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly notificationItemListRef = this.demoAppRouterService.userNotificationListRef();
  readonly makeNotificationItemAnchor: AnchorForValueFunction<NotificationItem> = (doc) => this.demoAppRouterService.userNotificationListNotificationRef(doc.id);

  constructor() {
    this.dbxFirebaseNotificationItemStore.setItems(this.notificationSummaryDocumentStore.notificationItems$);
    this.dbxFirebaseNotificationItemStore.setSelectedId(this._notificationIdInstance.paramValue$);
  }

  readonly handleCreateTestNotification: WorkUsingContext = (form, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.createTestNotification({}));
  };
}
