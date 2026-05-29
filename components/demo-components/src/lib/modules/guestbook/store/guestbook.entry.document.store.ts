import { first, type Observable, shareReplay, from, switchMap } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { type LoadingState, loadingStateFromObs } from '@dereekb/rxjs';
import { AbstractDbxFirebaseDocumentWithParentStore, firebaseDocumentStoreCrudFunction, firebaseDocumentStoreInvokeFunction } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, type Guestbook, type GuestbookDocument, type GuestbookEntry, type GuestbookEntryDocument, GuestbookFunctions, type InsertGuestbookEntryParams } from 'demo-firebase';
import { GuestbookDocumentStore } from './guestbook.document.store';

@Injectable()
export class GuestbookEntryDocumentStore extends AbstractDbxFirebaseDocumentWithParentStore<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument> {
  readonly guestbookFunctions = inject(GuestbookFunctions);

  constructor() {
    const collections = inject(DemoFirestoreCollections);
    super({ collectionFactory: collections.guestbookEntryCollectionFactory, firestoreCollectionLike: collections.guestbookEntryCollectionGroup });
    const parent = inject(GuestbookDocumentStore, { optional: true });

    if (parent) {
      this.setParentStore(parent);
    }
  }

  /**
   * Un-keyed invoke — collection-wide RPC that returns every published GuestbookEntry across all guestbooks.
   * Uses `firebaseDocumentStoreCrudFunction` because the params don't target the store's current document.
   */
  readonly allPublishedEntries = firebaseDocumentStoreCrudFunction(this.guestbookFunctions.guestbookEntry.invokeGuestbookEntry.allPublishedEntries);

  /**
   * Keyed invoke — returns a computed projection of the store's current entry.
   * Uses `firebaseDocumentStoreInvokeFunction` which injects `store.key$` into the request.
   */
  readonly entryDetails = firebaseDocumentStoreInvokeFunction(this, this.guestbookFunctions.guestbookEntry.invokeGuestbookEntry.entryDetails);

  insertEntry(params: Omit<InsertGuestbookEntryParams, 'guestbook'>): Observable<LoadingState<void>> {
    return this.parent$.pipe(
      first(),
      switchMap((parent) =>
        loadingStateFromObs(
          from(
            this.guestbookFunctions.guestbookEntry.updateGuestbookEntry.insert({
              ...params,
              guestbook: parent.id
            })
          )
        )
      ),
      shareReplay(1)
    );
  }
}
