import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { GuestbookEntry, GuestbookEntryDocument } from 'demo-firebase';
import { map } from 'rxjs';
import { GuestbookEntryDocumentStore } from './guestbook.entry.document.store';

@Directive({
    exportAs: 'guestbookEntry',
    selector: '[demoGuestbookEntryDocument]',
    providers: provideDbxFirebaseDocumentStoreDirective(DemoGuestbookEntryDocumentStoreDirective, GuestbookEntryDocumentStore),
    standalone: true
})
export class DemoGuestbookEntryDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<GuestbookEntry, GuestbookEntryDocument, GuestbookEntryDocumentStore> {
  constructor() {
    super(inject(GuestbookEntryDocumentStore));
  }

  readonly unpublished$ = this.data$.pipe(map((x) => !x.published));
}
