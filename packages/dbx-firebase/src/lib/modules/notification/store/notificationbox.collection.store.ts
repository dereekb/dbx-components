import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore, DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '../../../model/modules/store';
import { NotificationFirestoreCollections, NotificationBox, NotificationBoxDocument } from '@dereekb/firebase';

@Injectable()
export class NotificationBoxCollectionStore extends AbstractDbxFirebaseCollectionStore<NotificationBox, NotificationBoxDocument> {
  constructor(collections: NotificationFirestoreCollections) {
    super({ firestoreCollection: collections.notificationBoxCollection });
  }
}
