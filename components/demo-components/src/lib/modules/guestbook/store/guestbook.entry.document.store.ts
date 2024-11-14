import { first, Observable, shareReplay, from, switchMap } from 'rxjs';
import { Optional, Injectable, inject } from '@angular/core';
import { LoadingState, loadingStateFromObs } from '@dereekb/rxjs';
import { AbstractDbxFirebaseDocumentWithParentStore } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument, GuestbookFunctions, UpdateGuestbookEntryParams } from '@dereekb/demo-firebase';
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

  updateEntry(params: Omit<UpdateGuestbookEntryParams, 'guestbook'>): Observable<LoadingState<void>> {
    return this.parent$.pipe(
      first(),
      switchMap((parent) =>
        loadingStateFromObs(
          from(
            this.guestbookFunctions.guestbookEntry.updateGuestbookEntry({
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
