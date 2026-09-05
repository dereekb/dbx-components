import { type Maybe } from '@dereekb/util';
import {
  applyUserExternalConnectionEntry,
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
  type UserExternalConnectionProviderType,
  iterateFirestoreDocumentSnapshotPairs,
  userExternalConnectionEntryForOutcome,
  userExternalConnectionExternalAccountKeys,
  userExternalConnectionsWithExternalAccountQuery
} from '@dereekb/firebase';
import { applyUserExternalConnectionCredentials, type UserExternalConnectionCredentials, type UserExternalConnectionServerFirestoreCollections, userExternalConnectionGrantSummaryFromCredentials } from './userexternalconnection.private';
import { userExternalConnectionAlreadyExistsError, userExternalConnectionExternalAccountInUseError } from './userexternalconnection.error';
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
        await displaced.disconnect(now);
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
 */
export interface DisplacedUserExternalConnectionHolder {
  readonly uid: FirebaseAuthUserId;
  readonly disconnect: (now: Date) => Promise<void>;
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
          disconnect: async (now: Date) => {
            await otherHolder.accessor.set(
              applyUserExternalConnectionEntry({
                current: currentHolderData,
                uid: otherHolder.id,
                providerType,
                entry: userExternalConnectionEntryForOutcome({ outcome: 'disconnected', now, previous: currentHolderData?.e?.[providerType] }),
                now
              })
            );

            await otherHolderPrivateDocument.accessor.set(applyUserExternalConnectionCredentials({ current: currentHolderPrivateData, uid: otherHolder.id, providerType, credentials: null, now }));
          }
        };
      }
    }

    return result;
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
 * Parameters for {@link backfillUserExternalConnectionExternalAccountKeysFactory}.
 */
export interface BackfillUserExternalConnectionExternalAccountKeysParams {
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
 * The outcome of an `ec` backfill.
 */
export interface BackfillUserExternalConnectionExternalAccountKeysResult {
  readonly visited: number;
  readonly updated: number;
}

/**
 * Creates the one-off job that recomputes every document's derived `ec` array.
 *
 * Documents written BEFORE `ec` existed have none, and `ec` is what the uniqueness policy and the
 * sign-in lookup both query. Until this has run over a collection, a provider marked `unique` sees a
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

  return async (params?: Maybe<BackfillUserExternalConnectionExternalAccountKeysParams>): Promise<BackfillUserExternalConnectionExternalAccountKeysResult> => {
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
        const next = userExternalConnectionExternalAccountKeys(data.e);
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
