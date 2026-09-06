import { type Maybe } from '@dereekb/util';
import {
  applyUserExternalConnectionEntry,
  applyUserExternalConnectionLogin,
  emptyUserExternalConnection,
  type FirebaseAuthUserId,
  type FirestoreContextReference,
  type Transaction,
  type UserExternalConnectionDocument,
  type UserExternalConnectionEntryStatus,
  type UserExternalConnectionErrorCode,
  type UserExternalConnectionExternalAccountId,
  type UserExternalConnectionFirestoreCollections,
  type UserExternalConnectionGrantSummary,
  type UserExternalConnectionLogin,
  type UserExternalConnectionLoginIdentity,
  type UserExternalConnectionProviderType,
  iterateFirestoreDocumentSnapshotPairs,
  userExternalConnectionEntryForOutcome,
  userExternalConnectionExternalAccountKeys,
  userExternalConnectionLoginForIdentity,
  userExternalConnectionValue,
  userExternalConnectionsWithExternalAccountQuery
} from '@dereekb/firebase';
import { type FirebaseServerAuthService, getAuthUserOrUndefined } from '@dereekb/firebase-server';
import { applyUserExternalConnectionCredentials, type UserExternalConnectionCredentials, type UserExternalConnectionServerFirestoreCollections, userExternalConnectionGrantSummaryFromCredentials } from './userexternalconnection.private';
import { userExternalConnectionAlreadyExistsError, userExternalConnectionExternalAccountInUseError, userExternalConnectionUnlinkLastLoginMethodError } from './userexternalconnection.error';
import { type UserExternalConnectionProviderPolicyRegistry, userExternalConnectionPolicyForProviderType } from './userexternalconnection.policy';

/**
 * Context required by {@link userExternalConnectionServerActions}.
 *
 * Carries BOTH halves of the pair. Nothing else in the workspace should hold the private collection.
 */
export interface UserExternalConnectionServerActionsContext extends FirestoreContextReference, UserExternalConnectionFirestoreCollections, UserExternalConnectionServerFirestoreCollections {
  /**
   * The app's per-provider policies. Optional: a missing registry reads as "all defaults", which is
   * exactly the behavior this module had before policies existed.
   */
  readonly userExternalConnectionProviderPolicyRegistry?: Maybe<UserExternalConnectionProviderPolicyRegistry>;
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
  abstract deleteAllUserExternalConnectionsForUser(params: UserExternalConnectionDeleteAllParams): Promise<void>;
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
    refreshUserExternalConnectionCredentials: (params) => writePair({ ...params, outcome: 'connected' }),
    markUserExternalConnectionError: (params) => writePair({ ...params, outcome: 'error' }),
    disconnectUserExternalConnection: (params) => writePair({ ...params, outcome: 'disconnected' }),
    linkUserExternalConnectionLogin: linkUserExternalConnectionLoginFactory(context),
    unlinkUserExternalConnectionLogin: unlinkUserExternalConnectionLoginFactory(context),
    deleteAllUserExternalConnectionsForUser: deleteAllUserExternalConnectionsForUserFactory(context),
    backfillUserExternalConnectionExternalAccountKeys: backfillUserExternalConnectionExternalAccountKeysFactory(context),
    backfillUserExternalConnectionLogins: backfillUserExternalConnectionLoginsFactory(context)
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
  const { userExternalConnectionCollection, userExternalConnectionPrivateCollection, firestoreContext, userExternalConnectionProviderPolicyRegistry } = context;
  const resolveCollision = resolveUserExternalAccountCollisionInTransactionFactory(context);

  return async (params: WriteUserExternalConnectionPairParams): Promise<UserExternalConnectionDocument> => {
    const { uid, providerType, outcome, credentials, error, retainEntry } = params;
    const now = params.now ?? new Date();
    const policy = userExternalConnectionPolicyForProviderType(userExternalConnectionProviderPolicyRegistry, providerType);

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

      // still a READ, so it belongs above the writes
      const displaced = policy.unique && outcome === 'connected' && entry?.ea ? await resolveCollision({ transaction, uid, providerType, externalAccountId: entry.ea, policy: policy.onCollision }) : undefined;

      await publicDocument.accessor.set(applyUserExternalConnectionEntry({ current: currentPublic, uid, providerType, entry, now }));
      await privateDocument.accessor.set(applyUserExternalConnectionCredentials({ current: currentPrivate, uid, providerType, credentials: nextCredentials, now }));

      if (displaced) {
        await displaced.release(now);
      }

      return publicDocument;
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
