import { first, type Observable, shareReplay, from, switchMap } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { type LoadingState, loadingStateFromObs } from '@dereekb/rxjs';
import { AbstractDbxFirebaseDocumentWithParentStore } from '@dereekb/dbx-firebase';
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
