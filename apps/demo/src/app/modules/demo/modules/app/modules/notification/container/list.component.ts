import { AnchorForValueFunction } from '@dereekb/dbx-web';
import { Component, inject, OnInit } from '@angular/core';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { NotificationItem } from '@dereekb/firebase';
import { DbxRouterService, dbxRouteModelIdParamRedirect } from '@dereekb/dbx-core';
import { DbxFirebaseNotificationItemStore, NotificationSummaryDocumentStore } from '@dereekb/dbx-firebase';
import { distinctUntilChanged, map, of, shareReplay, switchMap } from 'rxjs';
import { LoadingState, WorkUsingContext, catchLoadingStateErrorWithOperator, successResult } from '@dereekb/rxjs';
import { ProfileDocumentStore } from 'demo-components';

@Component({
    templateUrl: './list.component.html',
    standalone: true
})
export class DemoNotificationListPageComponent implements OnInit {
  readonly profileDocumentStore = inject(ProfileDocumentStore);

  readonly dbxRouterService = inject(DbxRouterService);
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly dbxFirebaseNotificationItemStore = inject(DbxFirebaseNotificationItemStore);
  readonly notificationSummaryDocumentStore = inject(NotificationSummaryDocumentStore);

  readonly notificationItemsLoadingState$ = this.notificationSummaryDocumentStore.notificationItemsLoadingState$.pipe(catchLoadingStateErrorWithOperator<LoadingState<NotificationItem<any>[]>>(map(() => successResult([]))));

  private readonly _notificationIdInstance = dbxRouteModelIdParamRedirect(this.dbxRouterService);

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

  ngOnInit(): void {
    this.dbxFirebaseNotificationItemStore.setItems(this.notificationSummaryDocumentStore.notificationItems$);
    this.dbxFirebaseNotificationItemStore.setSelectedId(this._notificationIdInstance.paramValue$);
  }

  readonly handleCreateTestNotification: WorkUsingContext = (form, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.createTestNotification({}));
  };
}
