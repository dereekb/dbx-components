import { Directive } from '@angular/core';
import { type NotificationBox, type NotificationBoxDocument, type Notification, type NotificationDocument } from '@dereekb/firebase';
import { NotificationCollectionStore } from './notification.collection.store';
import { DbxFirebaseCollectionWithParentStoreDirective, provideDbxFirebaseCollectionWithParentStoreDirective } from '../../../model/modules/store/store.subcollection.directive';

@Directive({
  selector: '[dbxFirebaseNotificationCollection]',
  providers: provideDbxFirebaseCollectionWithParentStoreDirective(DbxFirebaseNotificationCollectionStoreDirective, NotificationCollectionStore),
  standalone: true
})
export class DbxFirebaseNotificationCollectionStoreDirective extends DbxFirebaseCollectionWithParentStoreDirective<Notification, NotificationBox, NotificationDocument, NotificationBoxDocument, NotificationCollectionStore> {
  constructor(store: NotificationCollectionStore) {
    super(store);
  }
}
