import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore } from '@dereekb/dbx-firebase';
import { type Calendar, type CalendarDocument } from '@dereekb/firebase';
import { DemoFirestoreCollections } from 'demo-firebase';

/**
 * Document store for a single {@link Calendar}.
 *
 * There is no update function here on purpose: the Calendar has no CRUD api, as event mutation is
 * caller-owned on the server. A client reads the model and renders it; writes arrive through the owning
 * model's own action (see `ProfileDocumentStore.createTestCalendarEvent`).
 */
@Injectable()
export class CalendarDocumentStore extends AbstractDbxFirebaseDocumentStore<Calendar, CalendarDocument> {
  constructor() {
    super({ firestoreCollection: inject(DemoFirestoreCollections).calendarCollection });
  }
}
