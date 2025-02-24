import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '../../../model/modules/store';
import { NotificationFirestoreCollections, NotificationSummary, NotificationSummaryDocument } from '@dereekb/firebase';

@Injectable()
export class NotificationSummaryCollectionStore extends AbstractDbxFirebaseCollectionStore<NotificationSummary, NotificationSummaryDocument> {
  constructor(collections: NotificationFirestoreCollections) {
    super({ firestoreCollection: collections.notificationSummaryCollection });
  }
}
