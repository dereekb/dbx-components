import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCreateFunction, firebaseDocumentStoreDeleteFunction, firebaseDocumentStoreUpdateFunction } from '@dereekb/dbx-firebase';
import { oidcModelCrudFunctionsConfig, OidcModelFirestoreCollections, OidcModelFunctions, type OidcEntry, type OidcEntryDocument } from '@dereekb/firebase';

/** Document store for a single {@link OidcEntry}. */
@Injectable()
export class OidcEntryDocumentStore extends AbstractDbxFirebaseDocumentStore<OidcEntry, OidcEntryDocument> {
  readonly oidcModelFunctions = inject(OidcModelFunctions);

  constructor() {
    super({ firestoreCollection: inject(OidcModelFirestoreCollections).oidcEntryCollection });
  }

  readonly createClient = firebaseDocumentStoreCreateFunction(this, this.oidcModelFunctions.oidcEntry.createOidcEntry.client);
  readonly updateClient = firebaseDocumentStoreUpdateFunction(this, this.oidcModelFunctions.oidcEntry.updateOidcEntry.client);
  readonly deleteClient = firebaseDocumentStoreDeleteFunction(this, this.oidcModelFunctions.oidcEntry.deleteOidcEntry.client);
}
