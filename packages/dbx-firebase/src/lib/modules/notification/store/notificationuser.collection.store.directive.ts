import { Directive } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '../../../model/modules/store';
import { NotificationUserCollectionStore } from './notificationuser.collection.store';
import { NotificationUser, NotificationUserDocument } from '@dereekb/firebase';

@Directive({
  selector: '[dbxFirebaseNotificationUserCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxFirebaseNotificationUserCollectionStoreDirective, NotificationUserCollectionStore)
})
export class DbxFirebaseNotificationUserCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<NotificationUser, NotificationUserDocument, NotificationUserCollectionStore> {
  constructor(store: NotificationUserCollectionStore) {
    super(store);
  }
}
