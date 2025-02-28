import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';
import { NotificationFirestoreCollections, NotificationFunctions, NotificationUser, NotificationUserDocument } from '@dereekb/firebase';

@Injectable()
export class NotificationUserDocumentStore extends AbstractDbxFirebaseDocumentStore<NotificationUser, NotificationUserDocument> {
  readonly notificationFunctions = inject(NotificationFunctions);

  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationUserCollection });
  }

  readonly updateNotificationUser = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notificationUser.updateNotificationUser.update);
  readonly resyncNotificationUser = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notificationUser.updateNotificationUser.resync);
}
