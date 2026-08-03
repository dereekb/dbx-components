import { type Maybe } from '@dereekb/util';
import { applyUserExternalConnectionEntry, emptyUserExternalConnection, type FirebaseAuthUserId, type FirestoreContextReference, type UserExternalConnectionDocument, type UserExternalConnectionEntryStatus, type UserExternalConnectionErrorCode, type UserExternalConnectionFirestoreCollections, type UserExternalConnectionGrantSummary, type UserExternalConnectionProviderType, userExternalConnectionEntryForOutcome } from '@dereekb/firebase';
import { applyUserExternalConnectionCredentials, type UserExternalConnectionCredentials, type UserExternalConnectionServerFirestoreCollections, userExternalConnectionGrantSummaryFromCredentials } from './userexternalconnection.private';
import { userExternalConnectionAlreadyExistsError } from './userexternalconnection.error';

/**
 * Context required by {@link userExternalConnectionServerActions}.
 *
 * Carries BOTH halves of the pair. Nothing else in the workspace should hold the private collection.
 */
export interface UserExternalConnectionServerActionsContext extends FirestoreContextReference, UserExternalConnectionFirestoreCollections, UserExternalConnectionServerFirestoreCollections {}

/**
 * Reference to a {@link UserExternalConnectionServerActions} instance.
 */
export interface UserExternalConnectionServerActionsRef {
  readonly userExternalConnectionActions: UserExternalConnectionServerActions;
}

// MARK: Params
/**
 * Parameters for connecting a user to a provider.
 *
 * NOTE what is absent: there is no parameter for `status`, `scopes`, `externalAccountId`,
 * `expiresAt`, `connectedAt`, `updatedAt`, or the connected-provider array. Every one of those is
 * derived from `credentials`, so a caller has no way to submit a summary that contradicts the
 * credentials it summarizes. `label` rides on the credentials because it is a fact about the grant.
 */
export interface UserExternalConnectionConnectParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  readonly credentials: UserExternalConnectionCredentials;
  /**
   * Optional instant to apply the change at. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Parameters for replacing a provider's credentials after a token refresh.
 */
export type UserExternalConnectionRefreshCredentialsParams = UserExternalConnectionConnectParams;

/**
 * Parameters for marking a provider's connection as errored.
 *
 * The stored credentials are retained so the connection can be repaired without a full reconnect.
 */
export interface UserExternalConnectionMarkErrorParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  readonly error?: Maybe<UserExternalConnectionErrorCode>;
  readonly now?: Maybe<Date>;
}

/**
 * Parameters for disconnecting a user from a provider.
 */
export interface UserExternalConnectionDisconnectParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * Whether to retain a `disconnected` history entry on the public document rather than removing the
   * provider's key. The credentials are removed either way. Defaults to false.
   */
  readonly retainEntry?: Maybe<boolean>;
  readonly now?: Maybe<Date>;
}

/**
 * Parameters for creating a user's connection document.
 */
export interface UserExternalConnectionCreateParams {
  readonly uid: FirebaseAuthUserId;
  /**
   * Optional instant to stamp the new document with. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Parameters for deleting a user's entire connection pair.
 */
export interface UserExternalConnectionDeleteAllParams {
  readonly uid: FirebaseAuthUserId;
}

// MARK: Actions
/**
 * Server-only actions for the UserExternalConnection document pair.
 *
 * This is the ENTIRE write surface, and ONLY the write surface. The two collections are never exposed
 * for independent mutation, so there is no way for a caller to write one document without the other —
 * and therefore no sync, reconciliation, or drift-detection process to maintain.
 *
 * Reading is `UserExternalConnectionAccessor` (raw) or `UserExternalConnectionReader` (the one a
 * consumer wants). A read used to live here too, which meant every path that only needed to look at a
 * user's credentials had to hold the write surface to do it.
 */
export abstract class UserExternalConnectionServerActions {
  abstract createUserExternalConnection(params: UserExternalConnectionCreateParams): Promise<UserExternalConnectionDocument>;
  abstract connectUserExternalConnection(params: UserExternalConnectionConnectParams): Promise<UserExternalConnectionDocument>;
  abstract refreshUserExternalConnectionCredentials(params: UserExternalConnectionRefreshCredentialsParams): Promise<UserExternalConnectionDocument>;
  abstract markUserExternalConnectionError(params: UserExternalConnectionMarkErrorParams): Promise<UserExternalConnectionDocument>;
  abstract disconnectUserExternalConnection(params: UserExternalConnectionDisconnectParams): Promise<UserExternalConnectionDocument>;
  abstract deleteAllUserExternalConnectionsForUser(params: UserExternalConnectionDeleteAllParams): Promise<void>;
}

/**
 * Creates a {@link UserExternalConnectionServerActions} bound to the given context.
 *
 * @param context - The context carrying both halves of the connection pair.
 * @returns A concrete UserExternalConnectionServerActions implementation.
 */
export function userExternalConnectionServerActions(context: UserExternalConnectionServerActionsContext): UserExternalConnectionServerActions {
  const writePair = writeUserExternalConnectionPairInTransactionFactory(context);

  return {
    createUserExternalConnection: createUserExternalConnectionFactory(context),
    connectUserExternalConnection: (params) => writePair({ ...params, outcome: 'connected' }),
    refreshUserExternalConnectionCredentials: (params) => writePair({ ...params, outcome: 'connected' }),
    markUserExternalConnectionError: (params) => writePair({ ...params, outcome: 'error' }),
    disconnectUserExternalConnection: (params) => writePair({ ...params, outcome: 'disconnected' }),
    deleteAllUserExternalConnectionsForUser: deleteAllUserExternalConnectionsForUserFactory(context)
  };
}

/**
 * Creates a function that creates a user's connection document.
 *
 * Only the public half is written: the private half exists to hold credentials, and the paired write
 * creates it on the first connect. Creation runs in a transaction so two concurrent calls cannot both
 * see an absent document and both write one.
 *
 * @param context - The context carrying both halves of the pair.
 * @returns A function that creates the document for a uid, throwing if it already exists.
 */
export function createUserExternalConnectionFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionCollection, firestoreContext } = context;

  return async (params: UserExternalConnectionCreateParams): Promise<UserExternalConnectionDocument> => {
    const { uid } = params;
    const now = params.now ?? new Date();

    return firestoreContext.runTransaction(async (transaction) => {
      const document = userExternalConnectionCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
      const exists = await document.accessor.exists();

      if (exists) {
        throw userExternalConnectionAlreadyExistsError(uid);
      }

      await document.accessor.set(emptyUserExternalConnection({ uid, now }));
      return document;
    });
  };
}

/**
 * Parameters for the paired write.
 */
export interface WriteUserExternalConnectionPairParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The outcome the operation produced. Drives BOTH sides of the pair.
   */
  readonly outcome: UserExternalConnectionEntryStatus;
  /**
   * The credentials the outcome produced. Required for a `connected` outcome; ignored for a
   * `disconnected` one (which always removes the stored credentials).
   */
  readonly credentials?: Maybe<UserExternalConnectionCredentials>;
  readonly error?: Maybe<UserExternalConnectionErrorCode>;
  readonly retainEntry?: Maybe<boolean>;
  readonly now?: Maybe<Date>;
}

/**
 * Resolves the credentials to store for an outcome.
 *
 * @param input
 * @param input.outcome - The outcome being applied.
 * @param input.credentials - Newly obtained credentials, if any.
 * @param input.previous - The credentials currently stored for this provider.
 * @returns The credentials to store, or null to remove the provider's credentials.
 */
function credentialsForUserExternalConnectionOutcome(input: { readonly outcome: UserExternalConnectionEntryStatus; readonly credentials?: Maybe<UserExternalConnectionCredentials>; readonly previous?: Maybe<UserExternalConnectionCredentials> }): Maybe<UserExternalConnectionCredentials> {
  const { outcome, credentials, previous } = input;
  let result: Maybe<UserExternalConnectionCredentials> = null;

  switch (outcome) {
    case 'connected':
      result = credentials;
      break;
    case 'error':
      // an errored connection keeps its credentials so it can be repaired by a refresh.
      result = credentials ?? previous;
      break;
    case 'disconnected':
      result = null;
      break;
  }

  return result;
}

/**
 * Creates the single function through which every mutation of the connection pair flows.
 *
 * Both documents are loaded from the same transaction, all reads happen before any write (a
 * Firestore transaction requirement), and both are written with the COMPLETE next value derived from
 * one input. A failure at any point leaves neither document changed.
 *
 * @param context - The context carrying both halves of the pair.
 * @returns A function that applies one provider's outcome to both documents atomically.
 */
export function writeUserExternalConnectionPairInTransactionFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionCollection, userExternalConnectionPrivateCollection, firestoreContext } = context;

  return async (params: WriteUserExternalConnectionPairParams): Promise<UserExternalConnectionDocument> => {
    const { uid, providerType, outcome, credentials, error, retainEntry } = params;
    const now = params.now ?? new Date();

    return firestoreContext.runTransaction(async (transaction) => {
      const publicDocument = userExternalConnectionCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
      const privateDocument = userExternalConnectionPrivateCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);

      // ALL READS BEFORE ANY WRITE
      const currentPublic = await publicDocument.snapshotData();
      const currentPrivate = await privateDocument.snapshotData();

      // ONE input -> BOTH sides. The entry is derived from the credentials being stored, never from
      // anything the caller supplied alongside them.
      const nextCredentials = credentialsForUserExternalConnectionOutcome({ outcome, credentials, previous: currentPrivate?.cr?.[providerType] });
      const grant: Maybe<UserExternalConnectionGrantSummary> = nextCredentials ? userExternalConnectionGrantSummaryFromCredentials(nextCredentials) : null;
      const entry = userExternalConnectionEntryForOutcome({ outcome, grant, error, retainEntry, now, previous: currentPublic?.e?.[providerType] });

      await publicDocument.accessor.set(applyUserExternalConnectionEntry({ current: currentPublic, uid, providerType, entry, now }));
      await privateDocument.accessor.set(applyUserExternalConnectionCredentials({ current: currentPrivate, uid, providerType, credentials: nextCredentials, now }));

      return publicDocument;
    });
  };
}

/**
 * Creates a function that deletes a user's entire connection pair in one transaction.
 *
 * @param context - The context carrying both halves of the pair.
 * @returns A function that removes both documents for a uid.
 */
export function deleteAllUserExternalConnectionsForUserFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionCollection, userExternalConnectionPrivateCollection, firestoreContext } = context;

  return async (params: UserExternalConnectionDeleteAllParams): Promise<void> => {
    const { uid } = params;

    return firestoreContext.runTransaction(async (transaction) => {
      const publicDocument = userExternalConnectionCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
      const privateDocument = userExternalConnectionPrivateCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);

      await publicDocument.accessor.delete();
      await privateDocument.accessor.delete();
    });
  };
}
