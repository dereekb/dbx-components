import { ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { AppNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';
import { DbxFirebaseNotificationTemplateService } from './service/notification.template.service';
import { DbxButtonModule, DbxListLayoutModule, DbxPopoverInteractionModule, DbxRouterListModule, DbxSectionLayoutModule, DbxWidgetModule } from '@dereekb/dbx-web';
import { DbxFirebaseNotificationItemListComponent, DbxFirebaseNotificationItemListViewComponent, DbxFirebaseNotificationItemListViewItemComponent } from './component/notificationitem.list.component';
import { CommonModule } from '@angular/common';
import { DbxFirebaseNotificationBoxDocumentStoreDirective } from './store/notificationbox.document.store.directive';
import { DbxFirebaseNotificationBoxCollectionStoreDirective } from './store/notificationbox.collection.store.directive';
import { DbxFirebaseNotificationSummaryCollectionStoreDirective, DbxFirebaseNotificationSummaryDocumentStoreDirective, DbxFirebaseNotificationUserCollectionStoreDirective, DbxFirebaseNotificationUserDocumentStoreDirective } from './store';
import { DbxFirebaseNotificationItemDefaultViewComponent } from './component/notificationitem.view.default.component';
import { DbxFirebaseNotificationItemViewComponent } from './component';
import { DbxValuePipeModule } from '@dereekb/dbx-core';
import { DbxFirebaseNotificationItemContentComponent } from './component/notificationitem.content.component';
import { DbxFirebaseNotificationItemStorePopoverButtonComponent, DbxFirebaseNotificationItemStorePopoverComponent } from './container';

const importsAndExports = [
  // components
  DbxFirebaseNotificationItemListComponent,
  DbxFirebaseNotificationItemListViewComponent,
  DbxFirebaseNotificationItemListViewItemComponent,

  DbxFirebaseNotificationItemContentComponent,
  DbxFirebaseNotificationItemViewComponent,
  DbxFirebaseNotificationItemDefaultViewComponent,

  // container
  DbxFirebaseNotificationItemStorePopoverButtonComponent,
  DbxFirebaseNotificationItemStorePopoverComponent,

  // stores
  DbxFirebaseNotificationBoxCollectionStoreDirective,
  DbxFirebaseNotificationBoxDocumentStoreDirective,
  DbxFirebaseNotificationSummaryCollectionStoreDirective,
  DbxFirebaseNotificationSummaryDocumentStoreDirective,
  DbxFirebaseNotificationUserCollectionStoreDirective,
  DbxFirebaseNotificationUserDocumentStoreDirective
];

/**
 * Used to initialize the DbxFirebaseNotificationModule.
 *
 * @deprecated import independent components instead
 *
 * @see DbxFirebaseNotificationItemListComponent
 * @see DbxFirebaseNotificationItemListViewComponent
 * @see DbxFirebaseNotificationItemListViewItemComponent
 * @see DbxFirebaseNotificationItemContentComponent
 * @see DbxFirebaseNotificationItemViewComponent
 * @see DbxFirebaseNotificationItemDefaultViewComponent
 * @see DbxFirebaseNotificationItemStorePopoverButtonComponent
 * @see DbxFirebaseNotificationItemStorePopoverComponent
 * @see DbxFirebaseNotificationBoxCollectionStoreDirective
 * @see DbxFirebaseNotificationBoxDocumentStoreDirective
 * @see DbxFirebaseNotificationSummaryCollectionStoreDirective
 * @see DbxFirebaseNotificationSummaryDocumentStoreDirective
 * @see DbxFirebaseNotificationUserCollectionStoreDirective
 * @see DbxFirebaseNotificationUserDocumentStoreDirective
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFirebaseNotificationModule {}
