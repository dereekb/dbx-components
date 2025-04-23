import { Directive } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { NotificationSummaryDocumentStore } from './notificationsummary.document.store';
import { NotificationSummary, NotificationSummaryDocument } from '@dereekb/firebase';

@Directive({
  selector: '[dbxFirebaseNotificationSummaryDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseNotificationSummaryDocumentStoreDirective, NotificationSummaryDocumentStore),
  standalone: true
})
export class DbxFirebaseNotificationSummaryDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<NotificationSummary, NotificationSummaryDocument, NotificationSummaryDocumentStore> {
  constructor(store: NotificationSummaryDocumentStore) {
    super(store);
  }
}
