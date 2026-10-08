import { Component, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective, DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective, DbxFirebaseNotificationItemStore, DbxFirebaseNotificationItemStorePopoverButtonComponent, DbxFirebaseNotificationSummaryDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { type AnchorForValueFunction, DbxContentLayoutModule, DbxNavbarComponent, DbxSectionPageComponent, DbxSpacerDirective } from '@dereekb/dbx-web';
import { type NotificationItem } from '@dereekb/firebase';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { type ClickableAnchorLinkSegueRef, DbxAppContextStateDirective, DbxRouteModelIdFromAuthUserIdDirective } from '@dereekb/dbx-core';
import { DemoProfileDocumentStoreDirective } from 'demo-components';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  providers: [DbxFirebaseNotificationItemStore],
  imports: [
    UIView,
    DbxAppContextStateDirective,
    DbxContentLayoutModule,
    DemoProfileDocumentStoreDirective,
    DbxRouteModelIdFromAuthUserIdDirective,
    DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective,
    DbxFirebaseNotificationSummaryDocumentStoreDirective,
    DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective,
    DbxSectionPageComponent,
    DbxSpacerDirective,
    DbxNavbarComponent,
    DbxFirebaseNotificationItemStorePopoverButtonComponent
  ]
})
export class DemoNotificationLayoutComponent {
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly makeNotificationItemAnchor: AnchorForValueFunction<NotificationItem> = (doc) => this.demoAppRouterService.userNotificationListNotificationRef(doc.id);

  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [
    { title: 'Inbox', icon: 'inbox', ...this.demoAppRouterService.userNotificationListRef() },
    { title: 'Settings', icon: 'tune', ...this.demoAppRouterService.userNotificationSettingsRef() }
  ];

  readonly notificationsButtonConfig = {
    makeNotificationItemAnchor: this.makeNotificationItemAnchor
  };
}
