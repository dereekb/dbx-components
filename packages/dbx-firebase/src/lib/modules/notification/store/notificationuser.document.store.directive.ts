import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { NotificationUserDocumentStore } from './notificationuser.document.store';
import { type NotificationUser, type NotificationUserDocument } from '@dereekb/firebase';

/**
 * Directive providing a {@link NotificationUserDocumentStore} for accessing a single notification user document.
 */
@Directive({
  selector: '[dbxFirebaseNotificationUserDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseNotificationUserDocumentStoreDirective, NotificationUserDocumentStore),
  standalone: true
})
export class DbxFirebaseNotificationUserDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<NotificationUser, NotificationUserDocument, NotificationUserDocumentStore> {
  constructor() {
    super(inject(NotificationUserDocumentStore));
  }
}
