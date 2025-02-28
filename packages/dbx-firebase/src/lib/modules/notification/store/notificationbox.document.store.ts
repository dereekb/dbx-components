import { Injectable, inject } from '@angular/core';
import { isSameDate } from '@dereekb/date';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';
import { NotificationFirestoreCollections, NotificationFunctions, NotificationBox, NotificationBoxDocument } from '@dereekb/firebase';
import { distinctUntilChanged, map, shareReplay } from 'rxjs';

@Injectable()
export class NotificationBoxDocumentStore extends AbstractDbxFirebaseDocumentStore<NotificationBox, NotificationBoxDocument> {
  readonly notificationFunctions = inject(NotificationFunctions);

  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationBoxCollection });
  }

  readonly createdAt$ = this.data$.pipe(
    map((x) => x.cat),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  readonly recipients$ = this.data$.pipe(
    map((x) => x.r),
    shareReplay(1)
  );

  readonly updateNotificationBox = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notificationBox.updateNotificationBox.update);
  readonly updateNotificationBoxRecipient = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notificationBox.updateNotificationBox.recipient);
}
