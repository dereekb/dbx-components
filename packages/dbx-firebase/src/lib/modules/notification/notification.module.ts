import { ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { AppNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';
import { DbxFirebaseNotificationTemplateService } from './service/notification.template.service';
import { DbxListLayoutModule } from '@dereekb/dbx-web';
import { DbxFirebaseNotificationItemListComponent, DbxFirebaseNotificationItemListViewComponent, DbxFirebaseNotificationItemListViewItemComponent } from './component/notificationitem.list.component';
import { CommonModule } from '@angular/common';
import { DbxFirebaseNotificationBoxDocumentStoreDirective } from './store/notificationbox.document.store.directive';
import { DbxFirebaseNotificationBoxCollectionStoreDirective } from './store/notificationbox.collection.store.directive';
import { DbxFirebaseNotificationSummaryCollectionStoreDirective, DbxFirebaseNotificationSummaryDocumentStoreDirective, DbxFirebaseNotificationUserCollectionStoreDirective, DbxFirebaseNotificationUserDocumentStoreDirective } from './store';

export interface DbxFirebaseNotificationModuleConfig {
  readonly appNotificationTemplateTypeInfoRecordService: AppNotificationTemplateTypeInfoRecordService;
}

const declarations = [
  // components

  // container
  DbxFirebaseNotificationItemListComponent,
  DbxFirebaseNotificationItemListViewComponent,
  DbxFirebaseNotificationItemListViewItemComponent,

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
  imports: [CommonModule, DbxListLayoutModule],
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
