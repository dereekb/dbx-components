import { Directive } from "@angular/core";
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from "@dereekb/dbx-firebase";
import { GuestbookEntry, GuestbookEntryDocument } from "@dereekb/demo-firebase";
import { GuestbookEntryDocumentStore } from "./guestbook.entry.document.store";

@Directive({
  exportAs: 'guestbookEntry',
  selector: '[demoGuestbookEntryDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DemoGuestbookEntryDocumentStoreDirective, GuestbookEntryDocumentStore)
})
export class DemoGuestbookEntryDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<GuestbookEntry, GuestbookEntryDocument, GuestbookEntryDocumentStore> {

  constructor(store: GuestbookEntryDocumentStore) {
    super(store);
  }

}
