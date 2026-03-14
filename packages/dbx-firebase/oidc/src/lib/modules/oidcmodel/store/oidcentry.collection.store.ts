import { inject, Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';
import { OidcModelFirestoreCollections, type OidcEntry, type OidcEntryDocument } from '@dereekb/firebase';

/** Collection store for querying {@link OidcEntry} documents. */
@Injectable()
export class OidcEntryCollectionStore extends AbstractDbxFirebaseCollectionStore<OidcEntry, OidcEntryDocument> {
  constructor() {
    super({ firestoreCollection: inject(OidcModelFirestoreCollections).oidcEntryCollection });
  }
}
