import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreInvokeFunction, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';
import { NotificationFirestoreCollections, NotificationFunctions, type NotificationUser, type NotificationUserDocument } from '@dereekb/firebase';

/**
 * Document store for a single NotificationUser with update, resync, and health check functions.
 */
@Injectable()
export class NotificationUserDocumentStore extends AbstractDbxFirebaseDocumentStore<NotificationUser, NotificationUserDocument> {
  readonly notificationFunctions = inject(NotificationFunctions);

  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationUserCollection });
  }

  readonly updateNotificationUser = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notificationUser.updateNotificationUser.update);
  readonly resyncNotificationUser = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notificationUser.updateNotificationUser.resync);

  /**
   * Runs a delivery health check for this NotificationUser.
   *
   * Dispatching a real test message is opt-in via the `sendProbe` param, since it delivers actual
   * mail/SMS to the user.
   *
   * The result is only returned by the call, so use the DbxFirebaseNotificationUserHealthCheckStore
   * to run a check whose outcome is retained as state.
   */
  readonly healthCheck = firebaseDocumentStoreInvokeFunction(this, this.notificationFunctions.notificationUser.invokeNotificationUser.healthCheck);
}
