import { inject, Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '../../../model/modules/store';
import { NotificationFirestoreCollections, type NotificationTaskBot, type NotificationTaskBotDocument } from '@dereekb/firebase';

/**
 * Collection store for querying NotificationTaskBot documents.
 */
@Injectable()
export class NotificationTaskBotCollectionStore extends AbstractDbxFirebaseCollectionStore<NotificationTaskBot, NotificationTaskBotDocument> {
  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationTaskBotCollection });
  }
}
