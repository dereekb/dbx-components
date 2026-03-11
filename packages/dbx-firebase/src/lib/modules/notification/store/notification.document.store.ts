import { Injectable, inject } from '@angular/core';
import { firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store/store.document.crud';
import { AbstractDbxFirebaseDocumentWithParentStore } from '../../../model/modules/store/store.subcollection.document';
import { NotificationBoxDocumentStore } from './notificationbox.document.store';
import { type Notification, type NotificationBox, type NotificationBoxDocument, type NotificationDocument, NotificationFirestoreCollections, NotificationFunctions } from '@dereekb/firebase';
import { distinctUntilChanged, map, shareReplay } from 'rxjs';
import { isSameDate } from '@dereekb/date';

/** Document store for a single Notification, providing derived observables for creation date, send state, and update functions. */
@Injectable()
export class NotificationDocumentStore extends AbstractDbxFirebaseDocumentWithParentStore<Notification, NotificationBox, NotificationDocument, NotificationBoxDocument> {
  readonly notificationFunctions = inject(NotificationFunctions);

  constructor() {
    super({ collectionFactory: inject(NotificationFirestoreCollections).notificationCollectionFactory, firestoreCollectionLike: inject(NotificationFirestoreCollections).notificationCollectionGroup });
    const parent = inject(NotificationBoxDocumentStore, { optional: true });

    if (parent) {
      this.setParentStore(parent);
    }
  }

  readonly createdAt$ = this.data$.pipe(
    map((x) => x.cat),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  readonly nextSendAt$ = this.data$.pipe(
    map((x) => x.sat),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  readonly sendType$ = this.data$.pipe(
    map((x) => x.st),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly sendAttemptsCount$ = this.data$.pipe(
    map((x) => x.a),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isUnique$ = this.data$.pipe(
    map((x) => x.ut),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly sendNotification = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notification.updateNotification.send);
}
