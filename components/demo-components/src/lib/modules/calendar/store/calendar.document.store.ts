import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore } from '@dereekb/dbx-firebase';
import { type Calendar, type CalendarDocument, firestoreModelKey, storageFileIdentity } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { DemoFirestoreCollections } from 'demo-firebase';
import { distinctUntilChanged, map, shareReplay } from 'rxjs';

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

  /**
   * Key of the StorageFile holding the published ICS, or undefined before the first publish.
   *
   * Mirrors `ProfileDocumentStore.zipArchiveStorageFileKey$`. Read off `isf` rather than recomputed from a
   * path, since the ICS object is keyed by the StorageFile's own id.
   */
  readonly icsStorageFileKey$ = this.currentData$.pipe(
    map((x): Maybe<string> => (x?.isf ? firestoreModelKey(storageFileIdentity, x.isf) : undefined)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * The last date the published ICS was successfully uploaded, or undefined before the first publish.
   */
  readonly syncedAt$ = this.currentData$.pipe(
    map((x) => x?.sat),
    distinctUntilChanged(),
    shareReplay(1)
  );
}
