import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '../../../model/modules/store';
import { NotificationFirestoreCollections, type NotificationUser, type NotificationUserDocument } from '@dereekb/firebase';

/**
 * Collection store for querying NotificationUser documents.
 */
@Injectable()
export class NotificationUserCollectionStore extends AbstractDbxFirebaseCollectionStore<NotificationUser, NotificationUserDocument> {
  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationUserCollection });
  }
}
