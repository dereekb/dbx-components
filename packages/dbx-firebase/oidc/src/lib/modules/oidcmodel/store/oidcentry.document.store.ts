import { Injectable, inject } from '@angular/core';
import { completeOnDestroy } from '@dereekb/dbx-core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCreateFunction, firebaseDocumentStoreDeleteFunction, firebaseDocumentStoreUpdateFunction } from '@dereekb/dbx-firebase';
import { OidcModelFirestoreCollections, OidcModelFunctions, type CreateOidcClientResult, type RotateOidcClientSecretResult, type OidcEntry, type OidcEntryDocument } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';

/** Document store for a single {@link OidcEntry}. */
@Injectable()
export class OidcEntryDocumentStore extends AbstractDbxFirebaseDocumentStore<OidcEntry, OidcEntryDocument> {
  readonly oidcModelFunctions = inject(OidcModelFunctions);

  private readonly _latestClientSecret$ = completeOnDestroy(new BehaviorSubject<Maybe<string>>(undefined));

  /**
   * The client secret from the most recent create operation.
   *
   * Only available immediately after creation — the server does not return it again.
   */
  readonly latestClientSecret$ = this._latestClientSecret$.asObservable();

  get latestClientSecret(): Maybe<string> {
    return this._latestClientSecret$.value;
  }

  constructor() {
    super({ firestoreCollection: inject(OidcModelFirestoreCollections).oidcEntryCollection });
  }

  readonly createClient = firebaseDocumentStoreCreateFunction(this, this.oidcModelFunctions.oidcEntry.createOidcEntry.client, {
    onResult: (_params, result: CreateOidcClientResult) => {
      this._latestClientSecret$.next(result.client_secret);
    }
  });

  readonly updateClient = firebaseDocumentStoreUpdateFunction(this, this.oidcModelFunctions.oidcEntry.updateOidcEntry.client);

  readonly rotateClientSecret = firebaseDocumentStoreUpdateFunction(this, this.oidcModelFunctions.oidcEntry.updateOidcEntry.rotateClientSecret, {
    onResult: (_params, result: RotateOidcClientSecretResult) => {
      this._latestClientSecret$.next(result.client_secret);
    }
  });

  readonly deleteClient = firebaseDocumentStoreDeleteFunction(this, this.oidcModelFunctions.oidcEntry.deleteOidcEntry.client);
}
