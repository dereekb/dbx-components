import { Injectable, inject } from '@angular/core';
import { type UserExternalConnection, type UserExternalConnectionDocument, type UserExternalConnectionFirestoreCollection, type UserExternalConnectionFirestoreCollections, UserExternalConnectionFunctions } from '@dereekb/firebase';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCreateFunction, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';

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
   * Creates the user's connection document.
   *
   * Required before any provider can be connected: the server asserts a role against this document,
   * and a role map is only consulted for a document that exists. Throws when the user already has
   * one, so call it only for a user known not to.
   */
  readonly createUserExternalConnection = firebaseDocumentStoreCreateFunction(this, this.userExternalConnectionFunctions.userExternalConnection.createUserExternalConnection);

  /**
   * Disconnects the user from a provider's DATA connection. The provider's login link is retained.
   */
  readonly disconnectUserExternalConnection = firebaseDocumentStoreUpdateFunction(this, this.userExternalConnectionFunctions.userExternalConnection.updateUserExternalConnection.disconnect);

  /**
   * Removes a provider as a login method. Strictly more than a disconnect — it takes the data
   * connection and its credentials with it.
   */
  readonly unlinkUserExternalConnectionLogin = firebaseDocumentStoreUpdateFunction(this, this.userExternalConnectionFunctions.userExternalConnection.updateUserExternalConnection.unlink);
}
