import { Directive, inject } from '@angular/core';
import { type NotificationBox, type NotificationBoxDocument, type Notification, type NotificationDocument } from '@dereekb/firebase';
import { NotificationCollectionStore } from './notification.collection.store';
import { DbxFirebaseCollectionWithParentStoreDirective, provideDbxFirebaseCollectionWithParentStoreDirective } from '../../../model/modules/store/store.subcollection.directive';

/**
 * Directive providing a {@link NotificationCollectionStore} for querying notifications within a template.
 */
@Directive({
  selector: '[dbxFirebaseNotificationCollection]',
  providers: provideDbxFirebaseCollectionWithParentStoreDirective(DbxFirebaseNotificationCollectionStoreDirective, NotificationCollectionStore),
  standalone: true
})
export class DbxFirebaseNotificationCollectionStoreDirective extends DbxFirebaseCollectionWithParentStoreDirective<Notification, NotificationBox, NotificationDocument, NotificationBoxDocument, NotificationCollectionStore> {
  constructor() {
    super(inject(NotificationCollectionStore));
  }
}
