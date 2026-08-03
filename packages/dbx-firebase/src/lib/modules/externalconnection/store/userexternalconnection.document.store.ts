import { Injectable, inject } from '@angular/core';
import { type UserExternalConnection, type UserExternalConnectionDocument, type UserExternalConnectionFirestoreCollection, type UserExternalConnectionFirestoreCollections, UserExternalConnectionFunctions } from '@dereekb/firebase';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';

/**
 * Injection token for the app's UserExternalConnection collection.
 *
 * The model's own `UserExternalConnectionFirestoreCollections` is an interface (the canonical model
 * folder shape) and so cannot be an Angular injection token. This abstract class is that token, and
 * is bound to the app's collections class by `provideDbxFirebaseExternalConnections()`.
 */
export abstract class DbxFirebaseUserExternalConnectionCollections implements UserExternalConnectionFirestoreCollections {
  abstract readonly userExternalConnectionCollection: UserExternalConnectionFirestoreCollection;
}

/**
 * Document store for the signed-in user's single UserExternalConnection document.
 *
 * The document id IS the user's uid, so this store is keyed with `setId(currentUid$)`.
 */
@Injectable()
export class UserExternalConnectionDocumentStore extends AbstractDbxFirebaseDocumentStore<UserExternalConnection, UserExternalConnectionDocument> {
  readonly userExternalConnectionFunctions = inject(UserExternalConnectionFunctions);

  constructor() {
    super({ firestoreCollection: inject(DbxFirebaseUserExternalConnectionCollections).userExternalConnectionCollection });
  }

  /**
   * Disconnects the user from a provider. The only write a client can make to the connection pair.
   */
  readonly disconnectUserExternalConnection = firebaseDocumentStoreUpdateFunction(this, this.userExternalConnectionFunctions.userExternalConnection.updateUserExternalConnection.disconnect);
}
