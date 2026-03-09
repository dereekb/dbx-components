import { inject, Directive } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { NotificationBoxDocumentStore } from './notificationbox.document.store';
import { type NotificationBox, type NotificationBoxDocument } from '@dereekb/firebase';

@Directive({
  selector: '[dbxFirebaseNotificationBoxDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseNotificationBoxDocumentStoreDirective, NotificationBoxDocumentStore),
  standalone: true
})
export class DbxFirebaseNotificationBoxDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<NotificationBox, NotificationBoxDocument, NotificationBoxDocumentStore> {
  constructor() {
    super(inject(NotificationBoxDocumentStore));
  }
}
