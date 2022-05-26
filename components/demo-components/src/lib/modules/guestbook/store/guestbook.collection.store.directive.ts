import { Directive } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '@dereekb/dbx-firebase';
import { Guestbook, GuestbookDocument } from '@dereekb/demo-firebase';
import { GuestbookCollectionStore } from './guestbook.collection.store';

@Directive({
  selector: '[demoGuestbookCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DemoGuestbookCollectionStoreDirective, GuestbookCollectionStore)
})
export class DemoGuestbookCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<Guestbook, GuestbookDocument, GuestbookCollectionStore> {
  constructor(store: GuestbookCollectionStore) {
    super(store);
  }
}
