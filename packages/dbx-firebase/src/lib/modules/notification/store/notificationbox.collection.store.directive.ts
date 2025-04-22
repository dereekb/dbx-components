import { Directive } from '@angular/core';
import { NotificationBoxCollectionStore } from './notificationbox.collection.store';
import { NotificationBox, NotificationBoxDocument } from '@dereekb/firebase';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '../../../model/modules/store';

@Directive({
  selector: '[dbxFirebaseNotificationBoxCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxFirebaseNotificationBoxCollectionStoreDirective, NotificationBoxCollectionStore),
  standalone: true
})
export class DbxFirebaseNotificationBoxCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<NotificationBox, NotificationBoxDocument, NotificationBoxCollectionStore> {
  constructor(store: NotificationBoxCollectionStore) {
    super(store);
  }
}
