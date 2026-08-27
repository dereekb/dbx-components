import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore } from '@dereekb/dbx-firebase';
import { type Calendar, type CalendarDocument, type CalendarSyncState, calendarSyncState, firestoreModelKey, storageFileIdentity } from '@dereekb/firebase';
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
   * The permanent public url the published ICS is served from, or undefined before the first publish.
   *
   * Read off the stored `iu` rather than recomputed from the path, because the storage host differs between
   * the emulator and production and the object is keyed by the ICS StorageFile's own id. Its absence is also
   * the "not yet published" state a link rotation passes through.
   */
  readonly icsUrl$ = this.currentData$.pipe(
    map((x) => x?.iu),
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

  /**
   * Where the calendar sits in the publish pipeline, or undefined before the document exists.
   *
   * Read alongside {@link syncedAt$} rather than instead of it: `sat` is the last successful upload, so on
   * its own it cannot tell a current feed from one that went stale the moment an event was added.
   */
  readonly syncState$ = this.currentData$.pipe(
    map((x): Maybe<CalendarSyncState> => (x ? calendarSyncState(x) : undefined)),
    distinctUntilChanged(),
    shareReplay(1)
  );
}
