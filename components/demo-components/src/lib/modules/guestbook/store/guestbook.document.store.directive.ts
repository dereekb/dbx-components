import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { Guestbook, GuestbookDocument } from 'demo-firebase';
import { GuestbookDocumentStore } from './guestbook.document.store';

@Directive({
    selector: '[demoGuestbookDocument]',
    providers: provideDbxFirebaseDocumentStoreDirective(DemoGuestbookDocumentStoreDirective, GuestbookDocumentStore),
    standalone: true
})
export class DemoGuestbookDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<Guestbook, GuestbookDocument, GuestbookDocumentStore> {
  constructor() {
    super(inject(GuestbookDocumentStore));
  }
}
