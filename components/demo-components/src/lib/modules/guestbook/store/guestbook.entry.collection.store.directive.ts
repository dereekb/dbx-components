import { Directive } from '@angular/core';
import { DbxFirebaseCollectionWithParentStoreDirective, provideDbxFirebaseCollectionWithParentStoreDirective } from '@dereekb/dbx-firebase';
import { type Guestbook, type GuestbookDocument, type GuestbookEntry, type GuestbookEntryDocument } from 'demo-firebase';
import { GuestbookEntryCollectionStore } from './guestbook.entry.collection.store';

@Directive({
    selector: '[demoGuestbookEntryCollection]',
    providers: provideDbxFirebaseCollectionWithParentStoreDirective(DemoGuestbookEntryCollectionStoreDirective, GuestbookEntryCollectionStore),
    standalone: true
})
export class DemoGuestbookEntryCollectionStoreDirective extends DbxFirebaseCollectionWithParentStoreDirective<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument, GuestbookEntryCollectionStore> {
  constructor(store: GuestbookEntryCollectionStore) {
    super(store);
  }
}
