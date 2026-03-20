import { inject, Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '../../../model/modules/store';
import { NotificationFirestoreCollections, type NotificationBox, type NotificationBoxDocument } from '@dereekb/firebase';

/**
 * Collection store for querying NotificationBox documents.
 */
@Injectable()
export class NotificationBoxCollectionStore extends AbstractDbxFirebaseCollectionStore<NotificationBox, NotificationBoxDocument> {
  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationBoxCollection });
  }
}
