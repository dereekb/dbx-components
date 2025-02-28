import { Directive } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { NotificationBoxDocumentStore } from './notificationbox.document.store';
import { NotificationBox, NotificationBoxDocument } from '@dereekb/firebase';

@Directive({
  selector: '[dbxFirebaseNotificationBoxDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseNotificationBoxDocumentStoreDirective, NotificationBoxDocumentStore)
})
export class DbxFirebaseNotificationBoxDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<NotificationBox, NotificationBoxDocument, NotificationBoxDocumentStore> {
  constructor(store: NotificationBoxDocumentStore) {
    super(store);
  }
}
