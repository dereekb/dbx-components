import { Optional, Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionWithParentStore } from '../../../model/modules/store/store.subcollection';
import { NotificationFirestoreCollections, type NotificationBox, type NotificationBoxDocument, type Notification, type NotificationDocument } from '@dereekb/firebase';
import { NotificationBoxDocumentStore } from './notificationbox.document.store';

@Injectable()
export class NotificationCollectionStore extends AbstractDbxFirebaseCollectionWithParentStore<Notification, NotificationBox, NotificationDocument, NotificationBoxDocument> {
  constructor(collections: NotificationFirestoreCollections, @Optional() parent: NotificationBoxDocumentStore) {
    super({ collectionFactory: collections.notificationCollectionFactory, collectionGroup: collections.notificationCollectionGroup });

    if (parent) {
      this.setParentStore(parent);
    }
  }
}
