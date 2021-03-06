import { Directive } from '@angular/core';
import { DbxFirebaseCollectionWithParentStoreDirective, provideDbxFirebaseCollectionWithParentStoreDirective } from '@dereekb/dbx-firebase';
import { Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument } from '@dereekb/demo-firebase';
import { GuestbookEntryCollectionStore } from './guestbook.entry.collection.store';

@Directive({
  selector: '[demoGuestbookEntryCollection]',
  providers: provideDbxFirebaseCollectionWithParentStoreDirective(DemoGuestbookEntryCollectionStoreDirective, GuestbookEntryCollectionStore)
})
export class DemoGuestbookEntryCollectionStoreDirective extends DbxFirebaseCollectionWithParentStoreDirective<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument, GuestbookEntryCollectionStore> {
  constructor(store: GuestbookEntryCollectionStore) {
    super(store);
  }
}
