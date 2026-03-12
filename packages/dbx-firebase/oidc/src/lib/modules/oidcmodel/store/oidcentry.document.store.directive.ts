import { inject, Directive } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { OidcEntryDocumentStore } from './oidcentry.document.store';
import { type OidcEntry, type OidcEntryDocument } from '@dereekb/firebase';

/** Directive providing a {@link OidcEntryDocumentStore} for accessing a single {@link OidcEntry} document. */
@Directive({
  selector: '[dbxOidcEntryDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxOidcEntryDocumentStoreDirective, OidcEntryDocumentStore),
  standalone: true
})
export class DbxOidcEntryDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<OidcEntry, OidcEntryDocument, OidcEntryDocumentStore> {
  constructor() {
    super(inject(OidcEntryDocumentStore));
  }
}
