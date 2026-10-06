import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCreateFunction, firebaseDocumentStoreInvokeFunction, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';
import { NotificationFirestoreCollections, NotificationFunctions, type NotificationUser, type NotificationUserDocument } from '@dereekb/firebase';

/**
 * Document store for a single NotificationUser with create, update, resync, and health check functions.
 */
@Injectable()
export class NotificationUserDocumentStore extends AbstractDbxFirebaseDocumentStore<NotificationUser, NotificationUserDocument> {
  readonly notificationFunctions = inject(NotificationFunctions);

  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationUserCollection });
  }

  /**
   * Creates the NotificationUser for a user, then targets this store at it.
   *
   * Idempotent on the server, so it is safe to call when the document may already exist.
   */
  readonly createNotificationUser = firebaseDocumentStoreCreateFunction(this, this.notificationFunctions.notificationUser.createNotificationUser);

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

  /**
   * Fixes issues the stored health check marked as fixable, then checks that delivery method again.
   *
   * Admin only on the server, since a fix changes state at the delivery provider. Use the
   * DbxFirebaseNotificationUserHealthCheckStore to run a fix whose outcome is retained as state.
   */
  readonly healthCheckAutofix = firebaseDocumentStoreInvokeFunction(this, this.notificationFunctions.notificationUser.invokeNotificationUser.healthCheckAutofix);
}
