import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseCollectionWithParentStore } from '../../../model/modules/store/store.subcollection';
import { NotificationFirestoreCollections, type NotificationBox, type NotificationBoxDocument, type Notification, type NotificationDocument } from '@dereekb/firebase';
import { NotificationBoxDocumentStore } from './notificationbox.document.store';

/**
 * Collection store for Notification documents, scoped to a parent NotificationBox when available.
 */
@Injectable()
export class NotificationCollectionStore extends AbstractDbxFirebaseCollectionWithParentStore<Notification, NotificationBox, NotificationDocument, NotificationBoxDocument> {
  constructor() {
    super({ collectionFactory: inject(NotificationFirestoreCollections).notificationCollectionFactory, collectionGroup: inject(NotificationFirestoreCollections).notificationCollectionGroup });
    const parent = inject(NotificationBoxDocumentStore, { optional: true });

    if (parent) {
      this.setParentStore(parent);
    }
  }
}
