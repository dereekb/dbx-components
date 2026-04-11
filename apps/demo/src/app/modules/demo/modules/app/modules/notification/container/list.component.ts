import { type AnchorForValueFunction, DbxActionModule, DbxButtonModule, DbxListEmptyContentComponent, DbxListItemAnchorModifierDirective, DbxListModifierModule, DbxTwoBlockComponent, DbxTwoColumnLayoutModule } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { type NotificationItem } from '@dereekb/firebase';
import { DbxRouterService, clean, dbxRouteModelIdParamRedirect } from '@dereekb/dbx-core';
import { DbxFirebaseNotificationItemListComponent, DbxFirebaseNotificationItemStore, NotificationSummaryDocumentStore } from '@dereekb/dbx-firebase';
import { distinctUntilChanged, map, of, shareReplay, switchMap } from 'rxjs';
import { type LoadingState, type WorkUsingContext, catchLoadingStateErrorWithOperator, successResult } from '@dereekb/rxjs';
import { ProfileDocumentStore } from 'demo-components';
import { UIView } from '@uirouter/angular';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  templateUrl: './list.component.html',
  imports: [UIView, DbxActionModule, DbxTwoBlockComponent, DbxTwoColumnLayoutModule, DbxFirebaseNotificationItemListComponent, DbxButtonModule, DbxListItemAnchorModifierDirective, DbxListEmptyContentComponent, DbxListModifierModule],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
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
      return exists
        ? this.notificationSummaryDocumentStore.notificationItems$.pipe(
            map((x) => x.length > 6),
            distinctUntilChanged(),
            shareReplay(1)
          )
        : of(false);
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly reachedTestLimitSignal = toSignal(this.reachedTestLimit$, { initialValue: false });

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
