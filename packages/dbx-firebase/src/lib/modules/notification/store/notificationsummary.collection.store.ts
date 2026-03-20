import { inject, Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '../../../model/modules/store';
import { NotificationFirestoreCollections, type NotificationSummary, type NotificationSummaryDocument } from '@dereekb/firebase';

/**
 * Collection store for querying NotificationSummary documents.
 */
@Injectable()
export class NotificationSummaryCollectionStore extends AbstractDbxFirebaseCollectionStore<NotificationSummary, NotificationSummaryDocument> {
  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationSummaryCollection });
  }
}
