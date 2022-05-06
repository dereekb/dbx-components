import { first, Observable, switchMap, shareReplay, from } from 'rxjs';
import { Optional, Injectable } from "@angular/core";
import { AbstractDbxFirebaseDocumentWithParentStore } from "@dereekb/dbx-firebase";
import { DemoFirestoreCollections, Guestbook, GuestbookDocument, GuestbookEntry, guestbookEntryDeleteKey, GuestbookEntryDocument, guestbookEntryUpdateKey, GuestbookFunctions, GuestbookFunctionTypeMap, UpdateGuestbookEntryParams } from "@dereekb/demo-firebase";
import { GuestbookDocumentStore } from "./guestbook.document.store";
import { LoadingState, loadingStateFromObs } from '@dereekb/rxjs';

@Injectable()
export class GuestbookEntryDocumentStore extends AbstractDbxFirebaseDocumentWithParentStore<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument> {

  constructor(readonly guestbookFunctions: GuestbookFunctions, collections: DemoFirestoreCollections, @Optional() parent: GuestbookDocumentStore) {
    super({ collectionFactory: collections.guestbookEntryCollectionFactory });

    if (parent) {
      this.setParentStore(parent);
    }
  }

  updateEntry(params: Omit<UpdateGuestbookEntryParams, 'guestbook'>): Observable<LoadingState<GuestbookEntry>> {
    return this.parent$.pipe(
      first(),
      switchMap((parent) =>
        loadingStateFromObs(from(this.guestbookFunctions[guestbookEntryUpdateKey]({
          ...params,
          guestbook: parent.id
        })))
      ),
      shareReplay(1)
    );
  }

}
