import { type Maybe } from '@dereekb/util';
import { applyUserExternalConnectionEntry, type FirebaseAuthUserId, type FirestoreContextReference, type UserExternalConnectionDocument, type UserExternalConnectionEntryStatus, type UserExternalConnectionErrorCode, type UserExternalConnectionFirestoreCollections, type UserExternalConnectionGrantSummary, type UserExternalConnectionProviderType, userExternalConnectionEntryForOutcome } from '@dereekb/firebase';
import { applyUserExternalConnectionCredentials, type UserExternalConnectionCredentials, type UserExternalConnectionServerFirestoreCollections, userExternalConnectionGrantSummaryFromCredentials } from './userexternalconnection.private';

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
 * Parameters for deleting a user's entire connection pair.
 */
export interface UserExternalConnectionDeleteAllParams {
  readonly uid: FirebaseAuthUserId;
}

/**
 * Parameters for reading a provider's stored credentials.
 */
export interface UserExternalConnectionReadCredentialsParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
}

// MARK: Actions
/**
 * Server-only actions for the UserExternalConnection document pair.
 *
 * This is the ENTIRE write surface. The two collections are never exposed for independent mutation,
 * so there is no way for a caller to write one document without the other — and therefore no sync,
 * reconciliation, or drift-detection process to maintain.
 */
export abstract class UserExternalConnectionServerActions {
  abstract connectUserExternalConnection(params: UserExternalConnectionConnectParams): Promise<UserExternalConnectionDocument>;
  abstract refreshUserExternalConnectionCredentials(params: UserExternalConnectionRefreshCredentialsParams): Promise<UserExternalConnectionDocument>;
  abstract markUserExternalConnectionError(params: UserExternalConnectionMarkErrorParams): Promise<UserExternalConnectionDocument>;
  abstract disconnectUserExternalConnection(params: UserExternalConnectionDisconnectParams): Promise<UserExternalConnectionDocument>;
  abstract deleteAllUserExternalConnectionsForUser(params: UserExternalConnectionDeleteAllParams): Promise<void>;
  abstract readUserExternalConnectionCredentials(params: UserExternalConnectionReadCredentialsParams): Promise<Maybe<UserExternalConnectionCredentials>>;
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
    connectUserExternalConnection: (params) => writePair({ ...params, outcome: 'connected' }),
    refreshUserExternalConnectionCredentials: (params) => writePair({ ...params, outcome: 'connected' }),
    markUserExternalConnectionError: (params) => writePair({ ...params, outcome: 'error' }),
    disconnectUserExternalConnection: (params) => writePair({ ...params, outcome: 'disconnected' }),
    deleteAllUserExternalConnectionsForUser: deleteAllUserExternalConnectionsForUserFactory(context),
    readUserExternalConnectionCredentials: readUserExternalConnectionCredentialsFactory(context)
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

/**
 * Creates a function that reads a provider's stored credentials in plaintext.
 *
 * Server paths that need credentials load both documents; the client can only ever load the public
 * one. The pairing is a WRITE invariant — reads are asymmetric by design.
 *
 * @param context - The context carrying both halves of the pair.
 * @returns A function that returns the decrypted credentials for a provider, if any.
 */
export function readUserExternalConnectionCredentialsFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionPrivateCollection } = context;

  return async (params: UserExternalConnectionReadCredentialsParams): Promise<Maybe<UserExternalConnectionCredentials>> => {
    const { uid, providerType } = params;
    const document = userExternalConnectionPrivateCollection.documentAccessor().loadDocumentForId(uid);
    const data = await document.snapshotData();
    return data?.cr?.[providerType];
  };
}
