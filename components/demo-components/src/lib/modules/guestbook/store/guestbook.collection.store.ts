import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, type Guestbook, type GuestbookDocument } from 'demo-firebase';

@Injectable()
export class GuestbookCollectionStore extends AbstractDbxFirebaseCollectionStore<Guestbook, GuestbookDocument> {
  constructor() {
    super({ firestoreCollection: inject(DemoFirestoreCollections).guestbookCollection });
  }
}
