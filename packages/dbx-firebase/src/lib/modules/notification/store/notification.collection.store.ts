import { Optional, Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionWithParentStore } from '../../../model/modules/store/store.subcollection';
import { NotificationFirestoreCollections, type NotificationBox, type NotificationBoxDocument, type Notification, type NotificationDocument } from '@dereekb/firebase';
import { NotificationBoxDocumentStore } from './notificationbox.document.store';
import { inject } from '@angular/core';

@Injectable()
export class NotificationCollectionStore extends AbstractDbxFirebaseCollectionWithParentStore<Notification, NotificationBox, NotificationDocument, NotificationBoxDocument> {
  constructor(@Optional() parent: NotificationBoxDocumentStore) {
    super({ collectionFactory: inject(NotificationFirestoreCollections).notificationCollectionFactory, collectionGroup: inject(NotificationFirestoreCollections).notificationCollectionGroup });

    if (parent) {
      this.setParentStore(parent);
    }
  }
}
