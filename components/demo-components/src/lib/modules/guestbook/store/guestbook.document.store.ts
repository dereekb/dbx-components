import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCreateFunction } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, Guestbook, GuestbookDocument, GuestbookFunctions } from '@dereekb/demo-firebase';

@Injectable()
export class GuestbookDocumentStore extends AbstractDbxFirebaseDocumentStore<Guestbook, GuestbookDocument> {
  readonly guestbookFunctions = inject(GuestbookFunctions);

  constructor(collections: DemoFirestoreCollections) {
    super({ firestoreCollection: collections.guestbookCollection });
  }

  readonly createGuestbook = firebaseDocumentStoreCreateFunction(this, this.guestbookFunctions.guestbook.createGuestbook);
}
