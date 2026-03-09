import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCreateFunction } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, type Guestbook, type GuestbookDocument, GuestbookFunctions } from 'demo-firebase';

@Injectable()
export class GuestbookDocumentStore extends AbstractDbxFirebaseDocumentStore<Guestbook, GuestbookDocument> {
  readonly guestbookFunctions = inject(GuestbookFunctions);

  constructor() {
    super({ firestoreCollection: inject(DemoFirestoreCollections).guestbookCollection });
  }

  readonly createGuestbook = firebaseDocumentStoreCreateFunction(this, this.guestbookFunctions.guestbook.createGuestbook);
}
