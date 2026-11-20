import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore } from '../../../model/modules/store';
import { NotificationFirestoreCollections, type NotificationRedirectEntry, type NotificationRedirectEntryDocument } from '@dereekb/firebase';

/**
 * Document store for a single NotificationRedirectEntry (the record behind a notification short link).
 *
 * Read only: entries are created and deleted by the server.
 */
@Injectable()
export class NotificationRedirectEntryDocumentStore extends AbstractDbxFirebaseDocumentStore<NotificationRedirectEntry, NotificationRedirectEntryDocument> {
  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationRedirectEntryCollection });
  }
}
