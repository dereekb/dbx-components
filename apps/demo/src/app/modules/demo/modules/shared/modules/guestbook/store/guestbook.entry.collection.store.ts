import { Injectable } from "@angular/core";
import { AbstractDbxFirebaseCollectionWithParentStore } from "@dereekb/dbx-firebase";
import { DemoFirestoreCollections, Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument } from "@dereekb/demo-firebase";
import { Optional } from "@nestjs/common";
import { GuestbookDocumentStore } from "./guestbook.document.store";

@Injectable()
export class GuestbookEntryCollectionStore extends AbstractDbxFirebaseCollectionWithParentStore<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument> {

  constructor(collections: DemoFirestoreCollections, @Optional() parent: GuestbookDocumentStore) {
    super({ collectionFactory: collections.guestbookEntryCollectionFactory });

    if (parent) {
      this.setParentStore(parent);
    }
  }

}
