import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, Guestbook, GuestbookDocument, publishedGuestbook } from '@dereekb/demo-firebase';

@Injectable()
export class GuestbookCollectionStore extends AbstractDbxFirebaseCollectionStore<Guestbook, GuestbookDocument> {
  constructor(collections: DemoFirestoreCollections) {
    super({ firestoreCollection: collections.guestbookFirestoreCollection });
    this.setConstraints(publishedGuestbook()); // todo: replace with filter
  }
}
