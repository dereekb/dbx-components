import { Optional, Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionWithParentStore } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument } from 'demo-firebase';
import { GuestbookDocumentStore } from './guestbook.document.store';

@Injectable()
export class GuestbookEntryCollectionStore extends AbstractDbxFirebaseCollectionWithParentStore<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument> {
  constructor(collections: DemoFirestoreCollections, @Optional() parent: GuestbookDocumentStore) {
    super({ collectionFactory: collections.guestbookEntryCollectionFactory, collectionGroup: collections.guestbookEntryCollectionGroup });

    if (parent) {
      this.setParentStore(parent);
    }
  }
}
