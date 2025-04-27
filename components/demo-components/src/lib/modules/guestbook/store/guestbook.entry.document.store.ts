import { first, Observable, shareReplay, from, switchMap } from 'rxjs';
import { Optional, Injectable, inject } from '@angular/core';
import { LoadingState, loadingStateFromObs } from '@dereekb/rxjs';
import { AbstractDbxFirebaseDocumentWithParentStore } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument, GuestbookFunctions, InsertGuestbookEntryParams } from 'demo-firebase';
import { GuestbookDocumentStore } from './guestbook.document.store';

@Injectable()
export class GuestbookEntryDocumentStore extends AbstractDbxFirebaseDocumentWithParentStore<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument> {
  readonly guestbookFunctions = inject(GuestbookFunctions);

  constructor(collections: DemoFirestoreCollections, @Optional() parent: GuestbookDocumentStore) {
    super({ collectionFactory: collections.guestbookEntryCollectionFactory, firestoreCollectionLike: collections.guestbookEntryCollectionGroup });
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
