import { Directive, inject } from '@angular/core';
import { NotificationBoxCollectionStore } from './notificationbox.collection.store';
import { type NotificationBox, type NotificationBoxDocument } from '@dereekb/firebase';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '../../../model/modules/store';

@Directive({
  selector: '[dbxFirebaseNotificationBoxCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxFirebaseNotificationBoxCollectionStoreDirective, NotificationBoxCollectionStore),
  standalone: true
})
export class DbxFirebaseNotificationBoxCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<NotificationBox, NotificationBoxDocument, NotificationBoxCollectionStore> {
  constructor() {
    super(inject(NotificationBoxCollectionStore));
  }
}
