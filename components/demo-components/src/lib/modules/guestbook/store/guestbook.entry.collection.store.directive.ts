import { Directive } from "@angular/core";
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from "@dereekb/dbx-firebase";
import { GuestbookEntry, GuestbookEntryDocument } from "@dereekb/demo-firebase";
import { GuestbookEntryCollectionStore } from "./guestbook.entry.collection.store";

@Directive({
  selector: '[demoGuestbookEntryCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DemoGuestbookEntryCollectionStoreDirective, GuestbookEntryCollectionStore)
})
export class DemoGuestbookEntryCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<GuestbookEntry, GuestbookEntryDocument, GuestbookEntryCollectionStore> {

  constructor(store: GuestbookEntryCollectionStore) {
    super(store);
  }

}
