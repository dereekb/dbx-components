import { Directive, inject } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '../../../model/modules/store';
import { NotificationUserCollectionStore } from './notificationuser.collection.store';
import { type NotificationUser, type NotificationUserDocument } from '@dereekb/firebase';

/**
 * Directive providing a {@link NotificationUserCollectionStore} for querying notification user documents.
 */
@Directive({
  selector: '[dbxFirebaseNotificationUserCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxFirebaseNotificationUserCollectionStoreDirective, NotificationUserCollectionStore),
  standalone: true
})
export class DbxFirebaseNotificationUserCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<NotificationUser, NotificationUserDocument, NotificationUserCollectionStore> {
  constructor() {
    super(inject(NotificationUserCollectionStore));
  }
}
