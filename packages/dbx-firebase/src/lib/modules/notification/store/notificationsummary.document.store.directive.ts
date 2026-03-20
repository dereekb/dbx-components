import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { NotificationSummaryDocumentStore } from './notificationsummary.document.store';
import { type NotificationSummary, type NotificationSummaryDocument } from '@dereekb/firebase';

/**
 * Directive providing a {@link NotificationSummaryDocumentStore} for accessing a single notification summary.
 */
@Directive({
  selector: '[dbxFirebaseNotificationSummaryDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseNotificationSummaryDocumentStoreDirective, NotificationSummaryDocumentStore),
  standalone: true
})
export class DbxFirebaseNotificationSummaryDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<NotificationSummary, NotificationSummaryDocument, NotificationSummaryDocumentStore> {
  constructor() {
    super(inject(NotificationSummaryDocumentStore));
  }
}
