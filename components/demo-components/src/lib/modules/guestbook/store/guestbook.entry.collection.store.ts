import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseCollectionWithParentStore } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, type Guestbook, type GuestbookDocument, type GuestbookEntry, type GuestbookEntryDocument } from 'demo-firebase';
import { GuestbookDocumentStore } from './guestbook.document.store';

@Injectable()
export class GuestbookEntryCollectionStore extends AbstractDbxFirebaseCollectionWithParentStore<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument> {
  constructor() {
    const collections = inject(DemoFirestoreCollections);
    super({ collectionFactory: collections.guestbookEntryCollectionFactory, collectionGroup: collections.guestbookEntryCollectionGroup });
    const parent = inject(GuestbookDocumentStore, { optional: true });

    if (parent) {
      this.setParentStore(parent);
    }
  }
}
