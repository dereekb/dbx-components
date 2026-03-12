import { Directive, inject } from '@angular/core';
import { OidcEntryCollectionStore } from './oidcentry.collection.store';
import { type OidcEntry, type OidcEntryDocument } from '@dereekb/firebase';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '@dereekb/dbx-firebase';

/** Directive providing a {@link OidcEntryCollectionStore} for querying {@link OidcEntry} documents. */
@Directive({
  selector: '[dbxOidcEntryCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxOidcEntryCollectionStoreDirective, OidcEntryCollectionStore),
  standalone: true
})
export class DbxOidcEntryCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<OidcEntry, OidcEntryDocument, OidcEntryCollectionStore> {
  constructor() {
    super(inject(OidcEntryCollectionStore));
  }
}
