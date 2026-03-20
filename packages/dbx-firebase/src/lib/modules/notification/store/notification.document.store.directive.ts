import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store/store.document.directive';
import { type Notification, type NotificationDocument } from '@dereekb/firebase';
import { NotificationDocumentStore } from './notification.document.store';

/**
 * Directive providing a {@link NotificationDocumentStore} for accessing a single notification document.
 */
@Directive({
  selector: '[dbxFirebaseNotificationDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseNotificationDocumentStoreDirective, NotificationDocumentStore),
  standalone: true
})
export class DbxFirebaseNotificationDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<Notification, NotificationDocument, NotificationDocumentStore> {
  constructor() {
    super(inject(NotificationDocumentStore));
  }
}
