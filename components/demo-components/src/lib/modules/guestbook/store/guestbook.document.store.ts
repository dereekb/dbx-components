import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, Guestbook, GuestbookDocument } from '@dereekb/demo-firebase';

@Injectable()
export class GuestbookDocumentStore extends AbstractDbxFirebaseDocumentStore<Guestbook, GuestbookDocument> {
  constructor(collections: DemoFirestoreCollections) {
    super({ firestoreCollection: collections.guestbookFirestoreCollection });
  }
}
