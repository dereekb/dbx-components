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

export interface DbxFirebaseNotificationModuleConfig {
  readonly appNotificationTemplateTypeInfoRecordService: AppNotificationTemplateTypeInfoRecordService;
}

const declarations = [
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
 */
@NgModule({
  imports: [CommonModule, DbxButtonModule, DbxRouterListModule, DbxPopoverInteractionModule, DbxSectionLayoutModule, DbxListLayoutModule, DbxWidgetModule, DbxValuePipeModule],
  declarations,
  exports: declarations
})
export class DbxFirebaseNotificationModule {
  static forRoot(config: DbxFirebaseNotificationModuleConfig): ModuleWithProviders<DbxFirebaseNotificationModule> {
    const { appNotificationTemplateTypeInfoRecordService } = config;

    const providers: Provider[] = [
      {
        provide: AppNotificationTemplateTypeInfoRecordService,
        useValue: appNotificationTemplateTypeInfoRecordService
      },
      {
        provide: DbxFirebaseNotificationTemplateService,
        useClass: DbxFirebaseNotificationTemplateService
      }
    ];

    return {
      ngModule: DbxFirebaseNotificationModule,
      providers
    };
  }
}
