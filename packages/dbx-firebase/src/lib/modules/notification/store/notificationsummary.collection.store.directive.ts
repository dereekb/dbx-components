import { Directive } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '../../../model/modules/store';
import { NotificationSummaryCollectionStore } from './notificationsummary.collection.store';
import { NotificationSummary, NotificationSummaryDocument } from '@dereekb/firebase';

@Directive({
  selector: '[dbxFirebaseNotificationSummaryCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxFirebaseNotificationSummaryCollectionStoreDirective, NotificationSummaryCollectionStore),
  standalone: true
})
export class DbxFirebaseNotificationSummaryCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<NotificationSummary, NotificationSummaryDocument, NotificationSummaryCollectionStore> {
  constructor(store: NotificationSummaryCollectionStore) {
    super(store);
  }
}
