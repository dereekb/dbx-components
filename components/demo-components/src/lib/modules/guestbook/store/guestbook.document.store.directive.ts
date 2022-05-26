import { Directive } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { Guestbook, GuestbookDocument } from '@dereekb/demo-firebase';
import { GuestbookDocumentStore } from './guestbook.document.store';

@Directive({
  selector: '[demoGuestbookDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DemoGuestbookDocumentStoreDirective, GuestbookDocumentStore)
})
export class DemoGuestbookDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<Guestbook, GuestbookDocument, GuestbookDocumentStore> {
  constructor(store: GuestbookDocumentStore) {
    super(store);
  }
}
