import { first, Observable, shareReplay, from, switchMap, map } from 'rxjs';
import { Optional, Injectable } from "@angular/core";
import { LoadingState, loadingStateFromObs } from '@dereekb/rxjs';
import { AbstractDbxFirebaseDocumentWithParentStore } from "@dereekb/dbx-firebase";
import { DemoFirestoreCollections, Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument, updateGuestbookEntryKey, GuestbookFunctions, UpdateGuestbookEntryParams } from "@dereekb/demo-firebase";
import { GuestbookDocumentStore } from "./guestbook.document.store";

@Injectable()
export class GuestbookEntryDocumentStore extends AbstractDbxFirebaseDocumentWithParentStore<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument> {

  constructor(readonly guestbookFunctions: GuestbookFunctions, collections: DemoFirestoreCollections, @Optional() parent: GuestbookDocumentStore) {
    super({ collectionFactory: collections.guestbookEntryCollectionFactory });

    if (parent) {
      this.setParentStore(parent);
    }
  }

  updateEntry(params: Omit<UpdateGuestbookEntryParams, 'guestbook'>): Observable<LoadingState<void>> {
    return this.parent$.pipe(
      first(),
      switchMap((parent) =>
        loadingStateFromObs(from(this.guestbookFunctions[updateGuestbookEntryKey]({
          ...params,
          guestbook: parent.id
        })))
      ),
      shareReplay(1)
    );
  }

}
