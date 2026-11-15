import { Logger } from '@nestjs/common';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import {
  applyUserExternalConnectionEntry,
  applyUserExternalConnectionLogin,
  emptyUserExternalConnection,
  type FirebaseAuthUserId,
  type FirestoreContextReference,
  type ReadUserExternalConnectionDataParams,
  readUserExternalConnectionDataParamsType,
  type ReadUserExternalConnectionDataResult,
  type Transaction,
  type UpdateUserExternalConnectionDataParams,
  updateUserExternalConnectionDataParamsType,
  type UpdateUserExternalConnectionDataResult,
  type UserExternalConnectionDocument,
  type UserExternalConnectionEntry,
  type UserExternalConnectionEntryStatus,
  type UserExternalConnectionErrorCode,
  type UserExternalConnectionExternalAccountId,
  type UserExternalConnectionFirestoreCollections,
  type UserExternalConnectionGrantSummary,
  type UserExternalConnectionLogin,
  type UserExternalConnectionLoginIdentity,
  type UserExternalConnectionProviderData,
  type UserExternalConnectionProviderType,
  iterateFirestoreDocumentSnapshotPairs,
  userExternalConnectionDataValueByteLength,
  userExternalConnectionEntryForOutcome,
  userExternalConnectionExternalAccountKeys,
  userExternalConnectionLoginForIdentity,
  userExternalConnectionValue,
  userExternalConnectionsWithExternalAccountQuery
} from '@dereekb/firebase';
import { type FirebaseServerActionsContext, type FirebaseServerAuthService, getAuthUserOrUndefined } from '@dereekb/firebase-server';
import {
  applyUserExternalConnectionCredentials,
  isUserExternalConnectionCredentialsExpired,
  type UserExternalConnectionCredentials,
  type UserExternalConnectionRefreshLeaseHolder,
  type UserExternalConnectionRefreshLeaseMap,
  type UserExternalConnectionServerFirestoreCollections,
  userExternalConnectionGrantSummaryFromCredentials
} from './userexternalconnection.private';
import { userExternalConnectionAlreadyExistsError, userExternalConnectionExternalAccountInUseError, userExternalConnectionRefreshLeaseLostError, userExternalConnectionUnlinkLastLoginMethodError } from './userexternalconnection.error';
import { type UserExternalConnectionProviderPolicyRegistry, userExternalConnectionPolicyForProviderType } from './userexternalconnection.policy';
import { type UserExternalConnectionData, type UserExternalConnectionDataDocument, type UserExternalConnectionStoredDataMap } from './data/userexternalconnection.data';
import { type UserExternalConnectionDataLimits, type UserExternalConnectionDataTypeRegistry, userExternalConnectionDataLimits, userExternalConnectionDataTypeRegistry } from './data/userexternalconnection.data.registry';
import { userExternalConnectionDataUnreadableError } from './data/userexternalconnection.data.error';
import {
  applyUserExternalConnectionDataUpdate,
  assertUserExternalConnectionDataOperationCount,
  readUserExternalConnectionDataResult,
  type UserExternalConnectionDataProviderAllowedFunction,
  userExternalConnectionDataItemSummaries,
  userExternalConnectionProviderDataValues
} from './data/userexternalconnection.data.util';

/**
 * Context required by {@link userExternalConnectionServerActions}.
 *
 * Carries BOTH halves of the pair, plus the connection data collection. Nothing else in the workspace should hold
 * the private collection.
 */
export interface UserExternalConnectionServerActionsContext extends FirebaseServerActionsContext, FirestoreContextReference, UserExternalConnectionFirestoreCollections, UserExternalConnectionServerFirestoreCollections {
  /**
   * The app's per-provider policies. Optional: a missing registry reads as "all defaults", which is
   * exactly the behavior this module had before policies existed.
   */
  readonly userExternalConnectionProviderPolicyRegistry?: Maybe<UserExternalConnectionProviderPolicyRegistry>;
  /**
   * The app's registered connection data types. Optional, and it fails closed: a missing registry reads as an empty
   * one, which refuses every data write and returns no data.
   */
  readonly userExternalConnectionDataTypeRegistry?: Maybe<UserExternalConnectionDataTypeRegistry>;
  /**
   * Overrides of the connection data limits. Unset limits use `DEFAULT_USER_EXTERNAL_CONNECTION_DATA_LIMITS`.
   */
  readonly userExternalConnectionDataLimits?: Maybe<Partial<UserExternalConnectionDataLimits>>;
  /**
   * The app's auth service, used ONLY by the unlink lockout guard to read whether the user still has a
   * Firebase-native login method.
   *
   * Optional because an app that never enables sign-in writes no login links and so never reaches the
   * guard. When it is absent and a link IS being removed, the guard reads the account as having no
   * native provider — the conservative answer, since the alternative is locking someone out.
   */
  readonly userExternalConnectionAuthService?: Maybe<FirebaseServerAuthService>;
}

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
export interface UserExternalConnectionRefreshCredentialsParams extends UserExternalConnectionConnectParams {
  /**
   * The refresh lease the refresh was performed under, when it was performed under one.
   *
   * Fences the persist: when set and the stored lease for this provider is no longer this holder's —
   * a reconnect, a disconnect or a takeover after expiry ended it — nothing is written and
   * `USER_EXTERNAL_CONNECTION_REFRESH_LEASE_LOST` is thrown instead.
   */
  readonly refreshLeaseHolder?: Maybe<UserExternalConnectionRefreshLeaseHolder>;
}

/**
 * Parameters for {@link UserExternalConnectionRefreshLeaseWriter.acquireUserExternalConnectionRefreshLease}.
 */
export interface AcquireUserExternalConnectionRefreshLeaseParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The refresh attempt asking for the lease.
   */
  readonly holder: UserExternalConnectionRefreshLeaseHolder;
  /**
   * The credentials the caller decided to refresh from. Stored credentials whose access token differs
   * from these AND that are still usable mean another instance already refreshed.
   */
  readonly previous: UserExternalConnectionCredentials;
  /**
   * How long the stored credentials must remain valid to count as already refreshed.
   */
  readonly buffer: Milliseconds;
  /**
   * How long the lease is held for once acquired.
   */
  readonly leaseDuration: Milliseconds;
  readonly now?: Maybe<Date>;
}

/**
 * The user is no longer connected to the provider; there is nothing to refresh.
 */
export interface UserExternalConnectionRefreshLeaseDisconnectedResult {
  readonly outcome: 'disconnected';
}

/**
 * Another instance refreshed since the caller read: the stored credentials are already usable.
 */
export interface UserExternalConnectionRefreshLeaseRefreshedResult {
  readonly outcome: 'refreshed';
  readonly credentials: UserExternalConnectionCredentials;
  readonly entry: UserExternalConnectionEntry;
}

/**
 * Another refresh attempt holds an unexpired lease.
 */
export interface UserExternalConnectionRefreshLeaseHeldResult {
  readonly outcome: 'held';
  /**
   * When the other holder's lease expires.
   */
  readonly until: Date;
  readonly credentials: UserExternalConnectionCredentials;
  readonly entry: UserExternalConnectionEntry;
}

/**
 * The caller now holds the lease, and should refresh from the STORED credentials returned here.
 */
export interface UserExternalConnectionRefreshLeaseAcquiredResult {
  readonly outcome: 'acquired';
  readonly credentials: UserExternalConnectionCredentials;
  readonly entry: UserExternalConnectionEntry;
}

/**
 * The result of {@link UserExternalConnectionRefreshLeaseWriter.acquireUserExternalConnectionRefreshLease}.
 */
export type AcquireUserExternalConnectionRefreshLeaseResult = UserExternalConnectionRefreshLeaseDisconnectedResult | UserExternalConnectionRefreshLeaseRefreshedResult | UserExternalConnectionRefreshLeaseHeldResult | UserExternalConnectionRefreshLeaseAcquiredResult;

/**
 * Parameters for {@link UserExternalConnectionRefreshLeaseWriter.releaseUserExternalConnectionRefreshLease}.
 */
export interface ReleaseUserExternalConnectionRefreshLeaseParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  readonly holder: UserExternalConnectionRefreshLeaseHolder;
}

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
 * Parameters for linking a provider as a LOGIN METHOD for a user.
 *
 * NOTE what is absent, as on {@link UserExternalConnectionConnectParams}: there is no parameter for any
 * field of the stored link. Every one is derived from `identity`, which the server read from a token it
 * obtained itself.
 */
export interface UserExternalConnectionLinkLoginParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The identity the identity-scoped OAuth round trip resolved.
   */
  readonly identity: UserExternalConnectionLoginIdentity;
  readonly now?: Maybe<Date>;
}

/**
 * Parameters for removing a provider as a login method for a user.
 */
export interface UserExternalConnectionUnlinkLoginParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
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

/**
 * Extra input for {@link UserExternalConnectionServerActions.readUserExternalConnectionData}, supplied by the
 * callable rather than by the caller.
 */
export interface ReadUserExternalConnectionDataActionInput {
  /**
   * The caller's own connection document, already checked for the `data` role. Its id is the uid whose data is read.
   */
  readonly userExternalConnectionDocument: UserExternalConnectionDocument;
  /**
   * Filters the providers whose data and data types are returned. Omitted means every provider.
   */
  readonly isProviderAllowed?: Maybe<UserExternalConnectionDataProviderAllowedFunction>;
}

/**
 * Parameters for {@link UserExternalConnectionServerActions.readUserExternalConnectionProviderData}.
 */
export interface ReadUserExternalConnectionProviderDataParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
}

/**
 * Parameters for {@link UserExternalConnectionServerActions.deleteUserExternalConnectionData}.
 */
export interface DeleteUserExternalConnectionDataParams {
  readonly uid: FirebaseAuthUserId;
}

// MARK: Actions
/**
 * Server-only actions for the UserExternalConnection document pair and the user's connection data.
 *
 * This is the ENTIRE write surface of the pair. The two collections are never exposed for independent
 * mutation, so there is no way for a caller to write one document without the other — and therefore no
 * sync, reconciliation, or drift-detection process to maintain.
 *
 * Reading the pair is `UserExternalConnectionAccessor` (raw) or `UserExternalConnectionReader` (the one a
 * consumer wants). A read used to live here too, which meant every path that only needed to look at a
 * user's credentials had to hold the write surface to do it.
 *
 * The connection data (`uecd`) is read here as well as written: its reads are the `read:data` callable and the
 * token mint, and each one decrypts and filters through the data type registry the writes validate against. A path
 * that only reads one provider's data should take a {@link UserExternalConnectionProviderDataReader}. The data actions
 * validate; they do not authorize. The calling handler is the authorization layer (always the caller's own uid, the
 * provider's connect policy, and the `data` role on the caller's `/uec` document).
 */
export abstract class UserExternalConnectionServerActions {
  abstract createUserExternalConnection(params: UserExternalConnectionCreateParams): Promise<UserExternalConnectionDocument>;
  abstract connectUserExternalConnection(params: UserExternalConnectionConnectParams): Promise<UserExternalConnectionDocument>;
  abstract refreshUserExternalConnectionCredentials(params: UserExternalConnectionRefreshCredentialsParams): Promise<UserExternalConnectionDocument>;
  abstract markUserExternalConnectionError(params: UserExternalConnectionMarkErrorParams): Promise<UserExternalConnectionDocument>;
  abstract disconnectUserExternalConnection(params: UserExternalConnectionDisconnectParams): Promise<UserExternalConnectionDocument>;
  /**
   * Records that a provider is a LOGIN METHOD for the user.
   *
   * Writes `li` and recomputes `c`/`ec`; `e` and the private credentials document are left untouched.
   * That separation is the point: the identity-scoped grant a link is established with is not the data
   * grant, so storing its credentials as the data connection would replace a broad grant with a narrow
   * one.
   */
  abstract linkUserExternalConnectionLogin(params: UserExternalConnectionLinkLoginParams): Promise<UserExternalConnectionDocument>;
  /**
   * Removes a provider as a login method for the user.
   *
   * Strictly larger than a disconnect: it removes the login link, the entry, AND the credentials in one
   * transaction. Unlinking is the user saying "this is no longer my account", which cannot leave a
   * live data connection to it behind.
   */
  abstract unlinkUserExternalConnectionLogin(params: UserExternalConnectionUnlinkLoginParams): Promise<UserExternalConnectionDocument>;
  /**
   * Deletes the user's `uec`, `uecp` and `uecd` documents in one transaction. To delete only the stored connection
   * data and keep the connections, use {@link UserExternalConnectionServerActions.deleteUserExternalConnectionData}.
   */
  abstract deleteAllUserExternalConnectionsForUser(params: UserExternalConnectionDeleteAllParams): Promise<void>;
  /**
   * Reads the user's connection data, filtered by the params and `isProviderAllowed`, plus the data types the user may
   * store. Backs the `read:data` callable.
   */
  abstract readUserExternalConnectionData(params: ReadUserExternalConnectionDataParams): Promise<TransformAndValidateFunctionResult<ReadUserExternalConnectionDataParams, (input: ReadUserExternalConnectionDataActionInput) => Promise<ReadUserExternalConnectionDataResult>>>;
  /**
   * Applies `clear`, then `unset`, then `set` to one provider's connection data in one transaction. Backs the
   * `update:data` callable.
   */
  abstract updateUserExternalConnectionData(params: UpdateUserExternalConnectionDataParams): Promise<TransformAndValidateFunctionResult<UpdateUserExternalConnectionDataParams, (userExternalConnectionDocument: UserExternalConnectionDocument) => Promise<UpdateUserExternalConnectionDataResult>>>;
  /**
   * The unwrapped connection data values of one provider — the token mint's read. An empty object when there are none.
   */
  abstract readUserExternalConnectionProviderData(params: ReadUserExternalConnectionProviderDataParams): Promise<UserExternalConnectionProviderData>;
  /**
   * Deletes the user's whole connection data document, i.e. every provider's data. Their `uec` connections and
   * `uecp` credentials are kept.
   *
   * Server-only. Call it from a server path such as the app's account deletion, an admin tool, a backfill or a
   * support fix. No callable, model API specifier or CLI command exposes it to users.
   *
   * It deletes without reading, so it also removes a document that can no longer be decrypted. A missing document
   * is a no-op. To clear only one provider's data, call
   * {@link UserExternalConnectionServerActions.updateUserExternalConnectionData} with `clear: true`. To remove
   * the connections as well, use {@link UserExternalConnectionServerActions.deleteAllUserExternalConnectionsForUser}.
   */
  abstract deleteUserExternalConnectionData(params: DeleteUserExternalConnectionDataParams): Promise<void>;
  /**
   * Recomputes every document's derived `ec` array. A one-off job — see
   * {@link backfillUserExternalConnectionExternalAccountKeysFactory}.
   */
  abstract backfillUserExternalConnectionExternalAccountKeys(params?: Maybe<BackfillUserExternalConnectionParams>): Promise<BackfillUserExternalConnectionResult>;
  /**
   * Creates a login link for every connected account that predates `li`. A one-off job — see
   * {@link backfillUserExternalConnectionLoginsFactory}.
   */
  abstract backfillUserExternalConnectionLogins(params?: Maybe<BackfillUserExternalConnectionParams>): Promise<BackfillUserExternalConnectionResult>;
  /**
   * Acquires the cross-instance refresh lease for one provider, or reports why not. See
   * {@link acquireUserExternalConnectionRefreshLeaseFactory}.
   */
  abstract acquireUserExternalConnectionRefreshLease(params: AcquireUserExternalConnectionRefreshLeaseParams): Promise<AcquireUserExternalConnectionRefreshLeaseResult>;
  /**
   * Releases a refresh lease, if the holder still holds it. See
   * {@link releaseUserExternalConnectionRefreshLeaseFactory}.
   */
  abstract releaseUserExternalConnectionRefreshLease(params: ReleaseUserExternalConnectionRefreshLeaseParams): Promise<void>;
}

/**
 * The one connection data read the token mint needs.
 *
 * Narrower than {@link UserExternalConnectionServerActions} on purpose, like the writers below — a full
 * `UserExternalConnectionServerActions` satisfies it.
 */
export interface UserExternalConnectionProviderDataReader {
  readUserExternalConnectionProviderData(params: ReadUserExternalConnectionProviderDataParams): Promise<UserExternalConnectionProviderData>;
}

/**
 * The two lease operations a reader's cross-instance refresh needs.
 *
 * Narrower than {@link UserExternalConnectionServerActions} on purpose, like the writers below — a full
 * `UserExternalConnectionServerActions` satisfies it.
 */
export interface UserExternalConnectionRefreshLeaseWriter {
  acquireUserExternalConnectionRefreshLease(params: AcquireUserExternalConnectionRefreshLeaseParams): Promise<AcquireUserExternalConnectionRefreshLeaseResult>;
  releaseUserExternalConnectionRefreshLease(params: ReleaseUserExternalConnectionRefreshLeaseParams): Promise<void>;
}

/**
 * The single write a per-user token cache needs: persisting credentials the provider just issued.
 *
 * Narrower than {@link UserExternalConnectionServerActions} on purpose. A token cache has no business
 * connecting, disconnecting, or deleting anything, and the resolved document is of no use to it — hence
 * the unconstrained result, which also means a caller can satisfy this without producing a document it
 * would only throw away.
 */
export interface UserExternalConnectionCredentialsWriter {
  refreshUserExternalConnectionCredentials(params: UserExternalConnectionRefreshCredentialsParams): Promise<unknown>;
}

/**
 * The two writes a reader performs: persisting a refresh, and recording that a provider rejected the
 * credentials.
 *
 * Also narrower than {@link UserExternalConnectionServerActions} on purpose — a read surface has no
 * business creating or deleting a connection — and for the same reason unconstrained in its results.
 */
export interface UserExternalConnectionCredentialsAndFailureWriter extends UserExternalConnectionCredentialsWriter {
  markUserExternalConnectionError(params: UserExternalConnectionMarkErrorParams): Promise<unknown>;
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
    refreshUserExternalConnectionCredentials: ({ refreshLeaseHolder, ...params }) => writePair({ ...params, outcome: 'connected', expectedRefreshLeaseHolder: refreshLeaseHolder }),
    markUserExternalConnectionError: (params) => writePair({ ...params, outcome: 'error' }),
    disconnectUserExternalConnection: (params) => writePair({ ...params, outcome: 'disconnected' }),
    linkUserExternalConnectionLogin: linkUserExternalConnectionLoginFactory(context),
    unlinkUserExternalConnectionLogin: unlinkUserExternalConnectionLoginFactory(context),
    deleteAllUserExternalConnectionsForUser: deleteAllUserExternalConnectionsForUserFactory(context),
    readUserExternalConnectionData: readUserExternalConnectionDataFactory(context),
    updateUserExternalConnectionData: updateUserExternalConnectionDataFactory(context),
    readUserExternalConnectionProviderData: readUserExternalConnectionProviderDataFactory(context),
    deleteUserExternalConnectionData: deleteUserExternalConnectionDataFactory(context),
    backfillUserExternalConnectionExternalAccountKeys: backfillUserExternalConnectionExternalAccountKeysFactory(context),
    backfillUserExternalConnectionLogins: backfillUserExternalConnectionLoginsFactory(context),
    acquireUserExternalConnectionRefreshLease: acquireUserExternalConnectionRefreshLeaseFactory(context),
    releaseUserExternalConnectionRefreshLease: releaseUserExternalConnectionRefreshLeaseFactory(context)
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
  /**
   * The refresh lease holder this write must still be fenced by.
   *
   * When set, the write is refused BEFORE anything is written — `USER_EXTERNAL_CONNECTION_REFRESH_LEASE_LOST`
   * — unless the stored lease for this provider still names this holder.
   */
  readonly expectedRefreshLeaseHolder?: Maybe<UserExternalConnectionRefreshLeaseHolder>;
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
  const { userExternalConnectionCollection, userExternalConnectionPrivateCollection, firestoreContext, userExternalConnectionProviderPolicyRegistry } = context;
  const resolveCollision = resolveUserExternalAccountCollisionInTransactionFactory(context);

  return async (params: WriteUserExternalConnectionPairParams): Promise<UserExternalConnectionDocument> => {
    const { uid, providerType, outcome, credentials, error, retainEntry, expectedRefreshLeaseHolder } = params;
    const now = params.now ?? new Date();
    const policy = userExternalConnectionPolicyForProviderType(userExternalConnectionProviderPolicyRegistry, providerType);

    return firestoreContext.runTransaction(async (transaction) => {
      const publicDocument = userExternalConnectionCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
      const privateDocument = userExternalConnectionPrivateCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);

      // ALL READS BEFORE ANY WRITE
      const currentPublic = await publicDocument.snapshotData();
      const currentPrivate = await privateDocument.snapshotData();

      // the persist fence: a refresh performed under a lease that has since been ended by another paired
      // write (a reconnect, a disconnect) or taken over after expiry must not overwrite what that wrote
      if (expectedRefreshLeaseHolder != null && currentPrivate?.rl?.[providerType]?.h !== expectedRefreshLeaseHolder) {
        throw userExternalConnectionRefreshLeaseLostError(providerType);
      }

      // ONE input -> BOTH sides. The entry is derived from the credentials being stored, never from
      // anything the caller supplied alongside them.
      const nextCredentials = credentialsForUserExternalConnectionOutcome({ outcome, credentials, previous: currentPrivate?.cr?.[providerType] });
      const grant: Maybe<UserExternalConnectionGrantSummary> = nextCredentials ? userExternalConnectionGrantSummaryFromCredentials(nextCredentials) : null;
      const entry = userExternalConnectionEntryForOutcome({ outcome, grant, error, retainEntry, now, previous: currentPublic?.e?.[providerType] });

      // still a READ, so it belongs above the writes
      const displaced = policy.unique && outcome === 'connected' && entry?.ea ? await resolveCollision({ transaction, uid, providerType, externalAccountId: entry.ea, policy: policy.onCollision }) : undefined;

      await publicDocument.accessor.set(applyUserExternalConnectionEntry({ current: currentPublic, uid, providerType, entry, now }));
      // a failure mark keeps the provider's refresh lease: it is written by whoever saw a 401, which may
      // be a different instance than the one mid-refresh, and ending that refresh's lease would make its
      // fenced persist drop a rotated refresh token the provider has already spent the old one for
      await privateDocument.accessor.set(applyUserExternalConnectionCredentials({ current: currentPrivate, uid, providerType, credentials: nextCredentials, now, endRefreshLease: outcome !== 'error' }));

      if (displaced) {
        await displaced.release(now);
      }

      return publicDocument;
    });
  };
}

/**
 * Creates the function that acquires a provider's cross-instance refresh lease.
 *
 * One transaction reads both halves of the pair and resolves to exactly one outcome:
 *
 * - `disconnected`: no entry, no credentials, or a `disconnected` entry. Nothing is written.
 * - `refreshed`: the stored access token differs from `previous` and is usable within `buffer` on a
 *   `connected` entry — another instance refreshed since the caller read. This is the re-read before
 *   refresh, and nothing is written.
 * - `held`: another holder's lease has not expired. Nothing is written.
 * - `acquired`: otherwise. The lease is written (`rl[providerType] = { h: holder, u: now + leaseDuration }`)
 *   and the STORED credentials are returned, which the caller must refresh from instead of the copy it
 *   read earlier.
 *
 * The lease is the one write to the private document that does not go through the paired write. It is
 * coordination state with no public counterpart, so writing it alone cannot make the pair disagree; the
 * credentials and `uat` are written back unchanged.
 *
 * @param context - The context carrying both halves of the pair.
 * @returns A function acquiring the lease inside a transaction.
 */
export function acquireUserExternalConnectionRefreshLeaseFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionCollection, userExternalConnectionPrivateCollection, firestoreContext } = context;

  return async (params: AcquireUserExternalConnectionRefreshLeaseParams): Promise<AcquireUserExternalConnectionRefreshLeaseResult> => {
    const { uid, providerType, holder, previous, buffer, leaseDuration } = params;
    const now = params.now ?? new Date();

    return firestoreContext.runTransaction(async (transaction) => {
      const publicDocument = userExternalConnectionCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
      const privateDocument = userExternalConnectionPrivateCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);

      const currentPublic = await publicDocument.snapshotData();
      const currentPrivate = await privateDocument.snapshotData();

      const entry = currentPublic?.e?.[providerType];
      const credentials = currentPrivate?.cr?.[providerType];
      let result: AcquireUserExternalConnectionRefreshLeaseResult;

      if (entry == null || credentials == null || currentPrivate == null || entry.st === 'disconnected') {
        result = { outcome: 'disconnected' };
      } else {
        const lease = currentPrivate.rl?.[providerType];

        if (entry.st === 'connected' && credentials.accessToken !== previous.accessToken && !isUserExternalConnectionCredentialsExpired({ credentials, buffer, now })) {
          result = { outcome: 'refreshed', credentials, entry };
        } else if (lease != null && lease.h !== holder && lease.u.getTime() > now.getTime()) {
          result = { outcome: 'held', until: lease.u, credentials, entry };
        } else {
          const rl: UserExternalConnectionRefreshLeaseMap = { ...currentPrivate.rl, [providerType]: { h: holder, u: new Date(now.getTime() + leaseDuration) } };
          await privateDocument.accessor.set({ ...currentPrivate, rl });
          result = { outcome: 'acquired', credentials, entry };
        }
      }

      return result;
    });
  };
}

/**
 * Creates the function that releases a provider's refresh lease.
 *
 * Removes the lease only while it still names `holder`; otherwise — already released, ended by a paired
 * write, or taken over — it is a no-op.
 *
 * @param context - The context carrying the private collection.
 * @returns A function releasing the lease inside a transaction.
 */
export function releaseUserExternalConnectionRefreshLeaseFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionPrivateCollection, firestoreContext } = context;

  return async (params: ReleaseUserExternalConnectionRefreshLeaseParams): Promise<void> => {
    const { uid, providerType, holder } = params;

    await firestoreContext.runTransaction(async (transaction) => {
      const privateDocument = userExternalConnectionPrivateCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
      const currentPrivate = await privateDocument.snapshotData();

      if (currentPrivate?.rl?.[providerType]?.h === holder) {
        const rl: UserExternalConnectionRefreshLeaseMap = { ...currentPrivate.rl };
        delete rl[providerType];
        await privateDocument.accessor.set({ ...currentPrivate, rl });
      }
    });
  };
}

/**
 * Input for the collision check performed inside the paired write's read phase.
 */
export interface ResolveUserExternalAccountCollisionInput {
  readonly transaction: Transaction;
  /**
   * The user doing the connecting. A document already held by THIS user is not a collision.
   */
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  readonly externalAccountId: UserExternalConnectionExternalAccountId;
  readonly policy: 'block' | 'transfer' | 'allow';
}

/**
 * A prior holder of an external account, and the write that removes their claim to it.
 *
 * Returned rather than performed so the caller keeps every read ahead of every write, which a
 * Firestore transaction requires.
 *
 * `release`, not `disconnect`: it removes the prior holder's LOGIN LINK as well as their entry and
 * credentials. `ec` is the union of both maps, so dropping only the entry would leave their key in
 * `ec` and break the very uniqueness invariant the transfer exists to maintain — two users would
 * answer "who is this account?".
 */
export interface DisplacedUserExternalConnectionHolder {
  readonly uid: FirebaseAuthUserId;
  readonly release: (now: Date) => Promise<void>;
}

/**
 * Creates the uniqueness check the paired write runs when a provider's policy declares its
 * connections unique.
 *
 * ## Known limitation, stated deliberately
 *
 * A Firestore transaction adds the documents a query RETURNED to its read set, but it does not lock
 * the ABSENCE of a match. Two simultaneous first-time connects to the same external account can
 * therefore both see no holder and both commit. The window is one transaction wide and every other
 * case (a second connect while a holder exists) is deterministic. Closing it entirely needs a
 * doc-id-keyed claim record — `<providerType>_<externalAccountId>` → uid, created in the same
 * transaction, where the id collision is what serializes the writers. That is additive whenever it
 * is needed.
 *
 * @param context - The context carrying the public collection.
 * @returns A function resolving the collision inside a transaction.
 */
export function resolveUserExternalAccountCollisionInTransactionFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionCollection, userExternalConnectionPrivateCollection } = context;

  return async (input: ResolveUserExternalAccountCollisionInput): Promise<Maybe<DisplacedUserExternalConnectionHolder>> => {
    const { transaction, uid, providerType, externalAccountId, policy } = input;
    let result: Maybe<DisplacedUserExternalConnectionHolder>;

    if (policy !== 'allow') {
      const holders = await userExternalConnectionCollection.queryDocument(userExternalConnectionsWithExternalAccountQuery({ providerType, externalAccountId })).getDocs(transaction);
      const otherHolder = holders.find((x) => x.id !== uid);

      if (otherHolder != null) {
        if (policy === 'block') {
          throw userExternalConnectionExternalAccountInUseError(providerType, externalAccountId, otherHolder.id);
        }

        // 'transfer': the prior holder's entry AND their credentials are dropped in this same
        // transaction, so the account is never claimed by two users at once — and the pair never
        // diverges into a private document holding live credentials for a public `disconnected` entry
        const otherHolderPrivateDocument = userExternalConnectionPrivateCollection.documentAccessorForTransaction(transaction).loadDocumentForId(otherHolder.id);
        const [currentHolderData, currentHolderPrivateData] = await Promise.all([otherHolder.snapshotData(), otherHolderPrivateDocument.snapshotData()]);

        result = {
          uid: otherHolder.id,
          release: async (now: Date) => {
            const withoutEntry = applyUserExternalConnectionEntry({
              current: currentHolderData,
              uid: otherHolder.id,
              providerType,
              entry: userExternalConnectionEntryForOutcome({ outcome: 'disconnected', now, previous: currentHolderData?.e?.[providerType] }),
              now
            });

            // and the login link, so the account they no longer hold is no longer a way for them to
            // sign in — and their key leaves `ec` with it
            await otherHolder.accessor.set(applyUserExternalConnectionLogin({ current: withoutEntry, uid: otherHolder.id, providerType, login: null, now }));
            await otherHolderPrivateDocument.accessor.set(applyUserExternalConnectionCredentials({ current: currentHolderPrivateData, uid: otherHolder.id, providerType, credentials: null, now }));
          }
        };
      }
    }

    return result;
  };
}

/**
 * Creates the function that records a provider as a LOGIN METHOD for a user.
 *
 * Writes ONLY the public document's `li` map, then recomputes `c`/`ec` from both maps. The entry map
 * and the credentials document are untouched, because the identity-scoped grant this link was
 * established with is not the data grant — persisting it as one would replace a broad grant with a
 * narrow one.
 *
 * Runs the same uniqueness check the paired write runs, for the same reason: after this write the
 * user's `ec` claims the account, and `unique` means at most one user may.
 *
 * @param context - The context carrying both halves of the pair.
 * @returns A function that applies one provider's login link.
 */
export function linkUserExternalConnectionLoginFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionCollection, firestoreContext, userExternalConnectionProviderPolicyRegistry } = context;
  const resolveCollision = resolveUserExternalAccountCollisionInTransactionFactory(context);

  return async (params: UserExternalConnectionLinkLoginParams): Promise<UserExternalConnectionDocument> => {
    const { uid, providerType, identity } = params;
    const now = params.now ?? new Date();
    const policy = userExternalConnectionPolicyForProviderType(userExternalConnectionProviderPolicyRegistry, providerType);

    return firestoreContext.runTransaction(async (transaction) => {
      const publicDocument = userExternalConnectionCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);

      // ALL READS BEFORE ANY WRITE
      const currentPublic = await publicDocument.snapshotData();
      const login = userExternalConnectionLoginForIdentity({ identity, previous: currentPublic?.li?.[providerType], now });

      // still a READ, so it belongs above the write
      const displaced = policy.unique ? await resolveCollision({ transaction, uid, providerType, externalAccountId: login.ea, policy: policy.onCollision }) : undefined;

      await publicDocument.accessor.set(applyUserExternalConnectionLogin({ current: currentPublic, uid, providerType, login, now }));

      if (displaced) {
        await displaced.release(now);
      }

      return publicDocument;
    });
  };
}

/**
 * Creates the function that removes a provider as a login method for a user.
 *
 * One transaction removing `li[providerType]`, `e[providerType]` and `cr[providerType]`. Strictly more
 * than a disconnect: an unlink is the user saying the third-party account is not theirs, which cannot
 * leave a live data connection to it behind.
 *
 * ## The lockout guard
 *
 * Refuses when removing the link would leave the account with NO remaining login link and NO
 * Firebase-native provider on the auth record — the state a custom-token-only user is in, and one
 * nobody can get back out of. Deliberately conservative: an app that provides no auth service to the
 * actions context reads as "no native provider", because guessing wrong in the other direction
 * produces an account no support path can recover.
 *
 * In practice this should rarely fire. The sign-in service provisions a password credential alongside
 * the email on every user it creates (`provisionPasswordCredential`, on by default), so those accounts
 * carry a `password` provider and can always recover through "forgot password". The guard is the
 * BACKSTOP for the cases that do not: a user created with no email, an app that turned the option off,
 * accounts created before it existed, and a user who has since removed their password credential.
 *
 * The guard is skipped entirely when the provider has no link to remove: nothing is being taken away
 * as a login method, and the call degenerates to a disconnect.
 *
 * @param context - The context carrying both halves of the pair.
 * @returns A function that unlinks one provider.
 */
export function unlinkUserExternalConnectionLoginFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionCollection, userExternalConnectionPrivateCollection, firestoreContext, userExternalConnectionAuthService } = context;

  return async (params: UserExternalConnectionUnlinkLoginParams): Promise<UserExternalConnectionDocument> => {
    const { uid, providerType } = params;
    const now = params.now ?? new Date();

    return firestoreContext.runTransaction(async (transaction) => {
      const publicDocument = userExternalConnectionCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
      const privateDocument = userExternalConnectionPrivateCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);

      // ALL READS BEFORE ANY WRITE
      const currentPublic = await publicDocument.snapshotData();
      const currentPrivate = await privateDocument.snapshotData();

      const currentLogin: Maybe<UserExternalConnectionLogin> = currentPublic?.li?.[providerType];

      if (currentLogin != null) {
        const remainingLinks = Object.keys(currentPublic?.li ?? {}).filter((x) => x !== providerType);

        if (remainingLinks.length === 0) {
          // not a Firestore read, so it is free to sit here; it is only reached in the one case that
          // can actually lock someone out
          const record = userExternalConnectionAuthService ? await getAuthUserOrUndefined(userExternalConnectionAuthService.auth.getUser(uid)) : undefined;

          if ((record?.providerData.length ?? 0) === 0) {
            throw userExternalConnectionUnlinkLastLoginMethodError(providerType);
          }
        }
      }

      const withoutEntry = applyUserExternalConnectionEntry({ current: currentPublic, uid, providerType, entry: null, now });

      await publicDocument.accessor.set(applyUserExternalConnectionLogin({ current: withoutEntry, uid, providerType, login: null, now }));
      await privateDocument.accessor.set(applyUserExternalConnectionCredentials({ current: currentPrivate, uid, providerType, credentials: null, now }));

      return publicDocument;
    });
  };
}

/**
 * Creates a function that deletes a user's entire connection pair, and their connection data, in one transaction.
 *
 * @param context - The context carrying both halves of the pair and the connection data collection.
 * @returns A function that removes the `uec`, `uecp` and `uecd` documents for a uid.
 */
export function deleteAllUserExternalConnectionsForUserFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionCollection, userExternalConnectionPrivateCollection, userExternalConnectionDataCollection, firestoreContext } = context;

  return async (params: UserExternalConnectionDeleteAllParams): Promise<void> => {
    const { uid } = params;

    return firestoreContext.runTransaction(async (transaction) => {
      const publicDocument = userExternalConnectionCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
      const privateDocument = userExternalConnectionPrivateCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
      const dataDocument = userExternalConnectionDataCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);

      await publicDocument.accessor.delete();
      await privateDocument.accessor.delete();
      await dataDocument.accessor.delete();
    });
  };
}

// MARK: Connection Data
/**
 * Resolves the context's data type registry, failing closed to an empty one.
 *
 * @param context - The actions context.
 * @returns The registry the data actions validate against.
 */
function userExternalConnectionDataTypeRegistryForContext(context: Pick<UserExternalConnectionServerActionsContext, 'userExternalConnectionDataTypeRegistry'>): UserExternalConnectionDataTypeRegistry {
  return context.userExternalConnectionDataTypeRegistry ?? userExternalConnectionDataTypeRegistry();
}

/**
 * Reads a connection data document's stored map, mapping a decrypt failure to `UNREADABLE`.
 *
 * @param dataDocument - The data document handle, built at the call site.
 * @returns The stored map; an empty one when the document does not exist.
 * @throws {HttpsError} `USER_EXTERNAL_CONNECTION_DATA_UNREADABLE_ERROR` when the document cannot be decrypted.
 */
async function readUserExternalConnectionStoredDataMap(dataDocument: UserExternalConnectionDataDocument): Promise<UserExternalConnectionStoredDataMap> {
  let data: Maybe<UserExternalConnectionData>;

  try {
    data = await dataDocument.snapshotData();
  } catch {
    throw userExternalConnectionDataUnreadableError();
  }

  return data?.d ?? {};
}

/**
 * Creates the `read:data` action: validates the params, then reads the connection data of the user who owns the given
 * connection document.
 *
 * @param context - The actions context.
 * @returns An async transform-and-validate function that reads connection data.
 */
export function readUserExternalConnectionDataFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionDataCollection, firebaseServerActionTransformFunctionFactory } = context;
  const registry = userExternalConnectionDataTypeRegistryForContext(context);

  return firebaseServerActionTransformFunctionFactory(readUserExternalConnectionDataParamsType, async (params) => {
    return async (input: ReadUserExternalConnectionDataActionInput): Promise<ReadUserExternalConnectionDataResult> => {
      const { userExternalConnectionDocument, isProviderAllowed } = input;
      const dataDocument = userExternalConnectionDataCollection.documentAccessor().loadDocumentForId(userExternalConnectionDocument.id);
      const stored = await readUserExternalConnectionStoredDataMap(dataDocument);
      return readUserExternalConnectionDataResult({ stored, params, registry, isProviderAllowed });
    };
  });
}

/**
 * Creates the `update:data` action: validates the params, then applies them to the connection data of the user who
 * owns the given connection document, in one transaction.
 *
 * An empty update, with no `set`, no `unset` and no `clear`, returns the current summary without writing. An
 * undecryptable document can only be replaced by a `clear`, since nothing in it can be preserved.
 *
 * @param context - The actions context.
 * @returns An async transform-and-validate function that updates connection data.
 */
export function updateUserExternalConnectionDataFactory(context: UserExternalConnectionServerActionsContext) {
  const { firestoreContext, userExternalConnectionDataCollection, firebaseServerActionTransformFunctionFactory } = context;
  const registry = userExternalConnectionDataTypeRegistryForContext(context);
  const limits = userExternalConnectionDataLimits(context.userExternalConnectionDataLimits);
  const logger = new Logger('UserExternalConnectionServerActions');

  return firebaseServerActionTransformFunctionFactory(updateUserExternalConnectionDataParamsType, async (params) => {
    const { providerType, clear } = params;
    const setCount = params.set?.length ?? 0;
    const unsetCount = params.unset?.length ?? 0;
    const isNoop = setCount === 0 && unsetCount === 0 && !clear;

    assertUserExternalConnectionDataOperationCount(setCount + unsetCount, limits);

    return async (userExternalConnectionDocument: UserExternalConnectionDocument): Promise<UpdateUserExternalConnectionDataResult> => {
      const uid = userExternalConnectionDocument.id;

      const next = await firestoreContext.runTransaction(async (transaction) => {
        const dataDocumentInTransaction = userExternalConnectionDataCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
        let current: Maybe<UserExternalConnectionStoredDataMap>;
        let exists = false;

        try {
          const data = await dataDocumentInTransaction.snapshotData();
          exists = data != null;
          current = data?.d;
        } catch {
          // an undecryptable document: only a clear may replace it, since nothing in it can be preserved
          if (!clear) {
            throw userExternalConnectionDataUnreadableError();
          }

          exists = true;
          current = {};
        }

        let result: UserExternalConnectionStoredDataMap = current ?? {};

        if (!isNoop) {
          result = applyUserExternalConnectionDataUpdate({ current, params, registry, limits, now: new Date() });

          if (Object.keys(result).length === 0) {
            if (exists) {
              await dataDocumentInTransaction.accessor.delete();
            }
          } else {
            await dataDocumentInTransaction.accessor.set({ uid, d: result, uat: new Date() });
          }
        }

        return result;
      });

      if (!isNoop) {
        logger.log(`Updated connection data for uid ${uid} provider "${providerType}" (set ${setCount}, unset ${unsetCount}${clear ? ', clear' : ''}; ${userExternalConnectionDataValueByteLength(next)} bytes).`);
      }

      return { items: userExternalConnectionDataItemSummaries({ stored: next, providerType, registry }) };
    };
  });
}

/**
 * Creates the token mint's read: one provider's connection data values, unwrapped.
 *
 * @param context - The actions context.
 * @returns The token mint's read, resolving one provider's values (an empty object when there are none).
 */
export function readUserExternalConnectionProviderDataFactory(context: Pick<UserExternalConnectionServerActionsContext, 'userExternalConnectionDataCollection' | 'userExternalConnectionDataTypeRegistry'>) {
  const { userExternalConnectionDataCollection } = context;
  const registry = userExternalConnectionDataTypeRegistryForContext(context);

  return async (params: ReadUserExternalConnectionProviderDataParams): Promise<UserExternalConnectionProviderData> => {
    const { uid, providerType } = params;
    const dataDocument = userExternalConnectionDataCollection.documentAccessor().loadDocumentForId(uid);
    const stored = await readUserExternalConnectionStoredDataMap(dataDocument);
    return userExternalConnectionProviderDataValues({ stored: stored[providerType], providerType, registry });
  };
}

/**
 * Creates the server-only delete of a user's whole connection data document. See
 * {@link UserExternalConnectionServerActions.deleteUserExternalConnectionData}.
 *
 * @param context - The actions context.
 * @returns The server-only delete, removing a uid's `uecd` document without reading it.
 */
export function deleteUserExternalConnectionDataFactory(context: Pick<UserExternalConnectionServerActionsContext, 'userExternalConnectionDataCollection'>) {
  const { userExternalConnectionDataCollection } = context;
  const logger = new Logger('UserExternalConnectionServerActions');

  return async (params: DeleteUserExternalConnectionDataParams): Promise<void> => {
    const { uid } = params;
    await userExternalConnectionDataCollection.documentAccessor().loadDocumentForId(uid).accessor.delete();
    logger.log(`Deleted the connection data document for uid ${uid}.`);
  };
}

// MARK: Backfill
/**
 * Parameters shared by the one-off backfills.
 */
export interface BackfillUserExternalConnectionParams {
  /**
   * How many documents to load per checkpoint. Defaults to 100.
   */
  readonly limitPerCheckpoint?: Maybe<number>;
  /**
   * When true, report what would change without writing anything. Defaults to false.
   */
  readonly dryRun?: Maybe<boolean>;
}

/**
 * The outcome of a backfill.
 */
export interface BackfillUserExternalConnectionResult {
  readonly visited: number;
  readonly updated: number;
}

/**
 * Creates the one-off job that recomputes every document's derived `ec` array.
 *
 * Documents written BEFORE `ec` existed have none, and `ec` is what the uniqueness policy and the
 * sign-in lookup both query. It is now the union of `e` and `li`, so this also repairs a document whose
 * `ec` predates login links. Until this has run over a collection, a provider marked `unique` sees a
 * pre-existing connection as no connection at all — it would let a second user claim an account the
 * first already holds, and a returning user would be treated as a stranger.
 *
 * Idempotent, and safe to re-run: `ec` is derived purely from `e`, so a document already carrying the
 * correct value is skipped rather than rewritten. Expose it through the app's developer-functions map
 * (`firebaseServerDevFunctions`) rather than any user-reachable route.
 *
 * @param context - The context carrying the public collection.
 * @returns A function performing the backfill.
 */
export function backfillUserExternalConnectionExternalAccountKeysFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionCollection } = context;

  return async (params?: Maybe<BackfillUserExternalConnectionParams>): Promise<BackfillUserExternalConnectionResult> => {
    const dryRun = params?.dryRun ?? false;
    let visited = 0;
    let updated = 0;

    await iterateFirestoreDocumentSnapshotPairs({
      queryFactory: userExternalConnectionCollection,
      constraintsFactory: [],
      limitPerCheckpoint: params?.limitPerCheckpoint ?? 100,
      documentAccessor: userExternalConnectionCollection.documentAccessor(),
      iterateSnapshotPair: async (pair) => {
        const { document, data } = pair;
        const next = userExternalConnectionExternalAccountKeys({ entries: data.e, logins: data.li });
        visited += 1;

        // a plain equality check on the joined values: both sides are sorted by the same derivation,
        // so an unchanged document is genuinely unchanged rather than merely reordered
        const changed = (data.ec ?? []).join(',') !== next.join(',');

        if (changed) {
          updated += 1;

          if (!dryRun) {
            await document.accessor.update({ ec: next });
          }
        }
      }
    });

    return { visited, updated };
  };
}

/**
 * Creates the one-off job that gives every pre-existing connection its LOGIN LINK.
 *
 * Connections established before `li` existed carry their identity only in the entry's `ea`. They keep
 * signing in — `ec` is the union, so the entry still resolves the account — but the settings page shows
 * the provider as NOT linked until the user runs the link flow once, and disconnecting the data
 * connection would then take the binding with it.
 *
 * Only entries whose provider policy declares `signIn: true` are backfilled. A connect-only provider is
 * not a login method, and inventing a link for one would put a sign-in binding on an account that never
 * agreed to it. An entry with no `ea` is skipped: there is no identity to record. A provider that
 * already has a link is left alone, so `lat` is never rewritten.
 *
 * Idempotent and safe to re-run. Expose it through the app's developer-functions map
 * (`firebaseServerDevFunctions`) rather than any user-reachable route.
 *
 * @param context - The context carrying the public collection and the provider policies.
 * @returns A function performing the backfill.
 */
export function backfillUserExternalConnectionLoginsFactory(context: UserExternalConnectionServerActionsContext) {
  const { userExternalConnectionCollection, userExternalConnectionProviderPolicyRegistry } = context;

  return async (params?: Maybe<BackfillUserExternalConnectionParams>): Promise<BackfillUserExternalConnectionResult> => {
    const dryRun = params?.dryRun ?? false;
    let visited = 0;
    let updated = 0;

    await iterateFirestoreDocumentSnapshotPairs({
      queryFactory: userExternalConnectionCollection,
      constraintsFactory: [],
      limitPerCheckpoint: params?.limitPerCheckpoint ?? 100,
      documentAccessor: userExternalConnectionCollection.documentAccessor(),
      iterateSnapshotPair: async (pair) => {
        const { document, data } = pair;
        const now = new Date();
        const entries = data.e ?? {};
        const logins = { ...data.li };
        let changed = false;

        visited += 1;

        Object.keys(entries).forEach((providerType) => {
          const externalAccountId = entries[providerType]?.ea;
          const policy = userExternalConnectionPolicyForProviderType(userExternalConnectionProviderPolicyRegistry, providerType);

          if (externalAccountId != null && policy.signIn && logins[providerType] == null) {
            logins[providerType] = userExternalConnectionLoginForIdentity({ identity: { externalAccountId, label: entries[providerType]?.l }, now });
            changed = true;
          }
        });

        if (changed) {
          updated += 1;

          if (!dryRun) {
            await document.accessor.set(userExternalConnectionValue({ uid: document.id, entries, logins, now }));
          }
        }
      }
    });

    return { visited, updated };
  };
}
