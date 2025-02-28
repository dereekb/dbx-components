import { Directive } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { NotificationUserDocumentStore } from './notificationuser.document.store';
import { NotificationUser, NotificationUserDocument } from '@dereekb/firebase';

@Directive({
  selector: '[dbxFirebaseNotificationUserDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseNotificationUserDocumentStoreDirective, NotificationUserDocumentStore)
})
export class DbxFirebaseNotificationUserDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<NotificationUser, NotificationUserDocument, NotificationUserDocumentStore> {
  constructor(store: NotificationUserDocumentStore) {
    super(store);
  }
}
