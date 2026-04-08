import { Directive, inject } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '@dereekb/dbx-firebase';
import { type Guestbook, type GuestbookDocument } from 'demo-firebase';
import { GuestbookCollectionStore } from './guestbook.collection.store';

@Directive({
  selector: '[demoGuestbookCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DemoGuestbookCollectionStoreDirective, GuestbookCollectionStore),
  standalone: true
})
export class DemoGuestbookCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<Guestbook, GuestbookDocument, GuestbookCollectionStore> {
  constructor() {
    super(inject(GuestbookCollectionStore));
  }
}
