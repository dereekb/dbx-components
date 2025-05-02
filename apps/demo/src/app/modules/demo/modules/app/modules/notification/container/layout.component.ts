import { Component, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective, DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective, DbxFirebaseNotificationItemStore, DbxFirebaseNotificationItemStorePopoverButtonComponent, DbxFirebaseNotificationSummaryDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { AnchorForValueFunction, DbxContentLayoutModule, DbxSectionPageComponent, DbxSpacerDirective } from '@dereekb/dbx-web';
import { NotificationItem } from '@dereekb/firebase';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { DbxAppContextStateDirective, DbxRouteModelIdFromAuthUserIdDirective } from '@dereekb/dbx-core';
import { DemoProfileDocumentStoreDirective } from 'demo-components';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  providers: [DbxFirebaseNotificationItemStore],
  imports: [UIView, DbxAppContextStateDirective, DbxContentLayoutModule, DemoProfileDocumentStoreDirective, DbxRouteModelIdFromAuthUserIdDirective, DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective, DbxFirebaseNotificationSummaryDocumentStoreDirective, DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective, DbxSectionPageComponent, DbxSpacerDirective, DbxFirebaseNotificationItemStorePopoverButtonComponent],
  standalone: true
})
export class DemoNotificationLayoutComponent {
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly makeNotificationItemAnchor: AnchorForValueFunction<NotificationItem> = (doc) => this.demoAppRouterService.userNotificationListNotificationRef(doc.id);

  readonly notificationsButtonConfig = {
    makeNotificationItemAnchor: this.makeNotificationItemAnchor
  };
}
