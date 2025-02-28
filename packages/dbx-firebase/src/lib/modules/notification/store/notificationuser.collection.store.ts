import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '../../../model/modules/store';
import { NotificationFirestoreCollections, NotificationUser, NotificationUserDocument } from '@dereekb/firebase';

@Injectable()
export class NotificationUserCollectionStore extends AbstractDbxFirebaseCollectionStore<NotificationUser, NotificationUserDocument> {
  constructor(collections: NotificationFirestoreCollections) {
    super({ firestoreCollection: collections.notificationUserCollection });
  }
}
