import { type EmailAddress, type Maybe } from '@dereekb/util';
import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import {
  AbstractFirestoreDocument,
  type CollectionReference,
  copyUserRelatedDataAccessorFactoryFunction,
  type FirestoreCollection,
  type FirestoreContext,
  type FirestoreModelData,
  firestoreDate,
  firestoreEnum,
  firestoreEnumArray,
  firestoreModelIdentity,
  firestoreObjectMap,
  firestoreUID,
  firestoreString,
  optionalFirestoreArray,
  optionalFirestoreBoolean,
  optionalFirestoreDate,
  optionalFirestoreEnum,
  optionalFirestoreString,
  snapshotConverterFunctions
} from '../../common';
import { type UserRelated, type UserRelatedById } from '../user';
import { type UserExternalConnectionCapability, type UserExternalConnectionExternalAccountId, type UserExternalConnectionExternalAccountKey, type UserExternalConnectionProviderType } from './userexternalconnection.id';

// MARK: Collections
/**
 * Provides access to the {@link UserExternalConnection} collection.
 *
 * NOTE: the private half of this model pair (`UserExternalConnectionPrivate`) is deliberately NOT
 * declared here. It exists only in `@dereekb/firebase-server/model`, so client-shared code cannot
 * name it.
 *
 * @dbxModelGroup UserExternalConnection
 */
export interface UserExternalConnectionFirestoreCollections {
  readonly userExternalConnectionCollection: UserExternalConnectionFirestoreCollection;
}

/**
 * Union of all UserExternalConnection model identity types.
 */
export type UserExternalConnectionTypes = typeof userExternalConnectionIdentity;

// MARK: UserExternalConnection
export const userExternalConnectionIdentity = firestoreModelIdentity('userExternalConnection', 'uec');

/**
 * Status of a single third-party connection.
 *
 * - `connected` — credentials are present and believed usable
 * - `disconnected` — the user (or the server) revoked the connection. Retained only for history.
 * - `error` — the connection exists but the credentials stopped working and need attention
 */
export type UserExternalConnectionEntryStatus = 'connected' | 'disconnected' | 'error';

export const USER_EXTERNAL_CONNECTION_ENTRY_STATUSES: UserExternalConnectionEntryStatus[] = ['connected', 'disconnected', 'error'];

/**
 * Short code describing why an entry is in the `error` status.
 *
 * Deliberately a code and not a message: the UI decides the wording, and a stored message would
 * leak provider internals into a client-readable document.
 */
export type UserExternalConnectionErrorCode = 'unauthorized' | 'expired' | 'revoked' | 'insufficient_scope' | 'provider_error' | 'unknown';

/**
 * Per-provider connection state stored inside a {@link UserExternalConnection}.
 *
 * Every field here is DERIVED by the server from the credentials that were stored alongside it —
 * see `userExternalConnectionEntryForOutcome()`. Nothing on this interface may be supplied directly
 * by a caller, otherwise the summary could contradict the credentials it summarizes.
 *
 * @dbxModelSubObject
 */
export interface UserExternalConnectionEntry {
  /**
   * Current status of this connection.
   *
   * @dbxModelVariable status
   */
  st: UserExternalConnectionEntryStatus;
  /**
   * Capabilities/scopes granted by the provider.
   *
   * @dbxModelVariable capabilities
   */
  ca?: Maybe<UserExternalConnectionCapability[]>;
  /**
   * Identifier of the connected account within the provider.
   *
   * @dbxModelVariable externalAccountId
   */
  ea?: Maybe<UserExternalConnectionExternalAccountId>;
  /**
   * Human-readable label for the connected account (e.g. the provider-side email or username).
   *
   * @dbxModelVariable label
   */
  l?: Maybe<string>;
  /**
   * Date the connection was first established.
   *
   * @dbxModelVariable connectedAt
   */
  coa?: Maybe<Date>;
  /**
   * Date the current access credentials expire at, when known.
   *
   * @dbxModelVariable expiresAt
   */
  exa?: Maybe<Date>;
  /**
   * Date this entry was last updated at.
   *
   * @dbxModelVariable updatedAt
   */
  uat: Date;
  /**
   * Reason the entry is in the `error` status. Cleared on any non-error outcome.
   *
   * @dbxModelVariable errorCode
   */
  er?: Maybe<UserExternalConnectionErrorCode>;
}

/**
 * Map of provider type to the user's connection state for that provider.
 */
export type UserExternalConnectionEntryMap = Record<UserExternalConnectionProviderType, UserExternalConnectionEntry>;

/**
 * A provider that is a LOGIN METHOD for this account.
 *
 * Separate from {@link UserExternalConnectionEntry} rather than a flag on it, because the two describe
 * different kinds of fact and have different lifecycles. Every field on an entry is DERIVED from the
 * credentials stored beside it — take the credentials away and the entry has nothing left to say — so
 * an entry is a statement about a grant. A login link is a statement about the ACCOUNT: "this Discord
 * user is how this person signs in". It survives the credentials expiring, being revoked by the
 * provider, and the user disconnecting the data connection, and it is removed only by an explicit
 * unlink.
 *
 * Folding it into the entry would mean a disconnect had to choose between destroying the sign-in
 * binding and retaining a `disconnected` entry that lies about the credentials. Two maps make the
 * choice unnecessary.
 *
 * Written ONLY by an identity-scoped OAuth round trip (the sign-in or `link` direction), never by the
 * data connect flow: the scopes a data connection is granted are not guaranteed to cover what an
 * identity read needs.
 *
 * @dbxModelSubObject
 */
export interface UserExternalConnectionLogin {
  /**
   * Identifier of the linked account within the provider. REQUIRED: this IS the identity.
   *
   * @dbxModelVariable externalAccountId
   */
  ea: UserExternalConnectionExternalAccountId;
  /**
   * Human-readable label for the linked account (e.g. the provider-side username).
   *
   * @dbxModelVariable label
   */
  l?: Maybe<string>;
  /**
   * The email the provider reported at link time, when it reported one.
   *
   * @dbxModelVariable email
   */
  em?: Maybe<EmailAddress>;
  /**
   * Whether the PROVIDER considered that email verified at link time.
   *
   * @dbxModelVariable emailVerified
   */
  emv?: Maybe<boolean>;
  /**
   * Date the provider was FIRST linked. Preserved across relinks.
   *
   * @dbxModelVariable linkedAt
   */
  lat: Date;
  /**
   * Date this link was last updated at.
   *
   * @dbxModelVariable updatedAt
   */
  uat: Date;
}

/**
 * Map of provider type to the login link the user holds for that provider.
 */
export type UserExternalConnectionLoginMap = Record<UserExternalConnectionProviderType, UserExternalConnectionLogin>;

/**
 * The client-readable half of a user's third-party OAuth connection state.
 *
 * There is exactly ONE of these per user, keyed by uid — per-provider details live inside `e`
 * rather than in separate documents. The server-only half holding the actual access/refresh
 * tokens is `UserExternalConnectionPrivate` in `@dereekb/firebase-server/model`, which shares this
 * document's id.
 *
 * The two documents are NEVER written independently. Every mutation goes through the paired
 * transaction accessor in `@dereekb/firebase-server/model`, which derives everything on this
 * document from the same input that produces the credentials. There is deliberately no sync,
 * reconciliation, or drift-detection process — divergence is unrepresentable rather than detectable.
 *
 * @dbxModel
 * @dbxModelRead owner
 */
export interface UserExternalConnection extends UserRelated, UserRelatedById {
  /**
   * Per-provider connection state, keyed by provider type.
   *
   * @dbxModelVariable entries
   */
  e: UserExternalConnectionEntryMap;
  /**
   * DERIVED from `e`: every provider type whose entry status is `connected`.
   *
   * This exists solely so "which users are connected to X?" stays queryable after collapsing to a
   * single document per user — Firestore cannot query across map keys, but it can `array-contains`
   * this field. It is recomputed from `e` on every write and is never passed in by a caller.
   *
   * Entries in the `disconnected` or `error` status are excluded: a "usable connections" query that
   * returned users whose credentials stopped working would be worse than useless, and
   * `array-contains` cannot filter by status to compensate.
   *
   * @dbxModelVariable connectedProviderTypes
   */
  c: UserExternalConnectionProviderType[];
  /**
   * Per-provider LOGIN LINKS, keyed by provider type.
   *
   * A provider present here is a way this account signs in. Independent of `e`: a provider can be
   * linked without a data connection (the sign-in wrote the link and the app did not opt into
   * `signInConnects`), connected without being linked (a connect-only provider), or both.
   *
   * @dbxModelVariable logins
   */
  li: UserExternalConnectionLoginMap;
  /**
   * DERIVED from `e` UNION `li`: the `<providerType>:<externalAccountId>` key of every entry that
   * names an external account, plus every login link's.
   *
   * The `c` array's sibling, and it exists for the same reason: Firestore cannot query across map
   * keys, so `e.<provider>.ea` is unreachable. `c` answers "who is connected to X?"; this answers
   * "who IS X?" — the lookup a sign-in performs to resolve a third-party identity to a Firebase uid.
   *
   * Both maps contribute because either one alone loses the answer. Sourcing it from `e` only meant
   * disconnecting a data connection silently destroyed the sign-in binding and the next sign-in minted
   * a second Firebase user; sourcing it from `li` only would lose a connect-established account that
   * was never a login method.
   *
   * Unlike `c`, membership is NOT filtered by status. Which Discord account a user is is a fact
   * about their identity, not about whether their credentials currently work: a returning user whose
   * token expired (`error`) must still resolve to the same uid, or a sign-in would mint them a
   * second account. Recomputed on every write and never passed in by a caller.
   *
   * @dbxModelVariable externalAccountKeys
   */
  ec?: Maybe<UserExternalConnectionExternalAccountKey[]>;
  /**
   * Date this document was last updated at.
   *
   * @dbxModelVariable updatedAt
   */
  uat: Date;
}

/**
 * Roles for a UserExternalConnection. Users can read their own connection state; all writes go
 * through the server.
 *
 * `connect`, `disconnect` and `unlink` are called out separately from `update` because they are the
 * only operations a client can reach, so an app can withhold any one of them (a user allowed to drop a
 * connection but not to add another, or the reverse) without also withholding the server-driven
 * writes that share `update`.
 *
 * `unlink` is distinct from `disconnect` because they remove different things: a disconnect drops the
 * data connection and keeps the login link, an unlink removes the login link AND everything the
 * disconnect would have. Removing a way to sign in is the more consequential of the two, so an app can
 * grant one without the other.
 */
export type UserExternalConnectionRoles = GrantedReadRole | GrantedUpdateRole | 'connect' | 'disconnect' | 'unlink';

export class UserExternalConnectionDocument extends AbstractFirestoreDocument<UserExternalConnection, UserExternalConnectionDocument, typeof userExternalConnectionIdentity> {
  get modelIdentity() {
    return userExternalConnectionIdentity;
  }
}

/**
 * Field conversions for a {@link UserExternalConnectionEntry}.
 */
export const userExternalConnectionEntryFields = {
  st: firestoreEnum<UserExternalConnectionEntryStatus>({ default: 'disconnected' }),
  ca: optionalFirestoreArray<UserExternalConnectionCapability>(),
  ea: optionalFirestoreString(),
  l: optionalFirestoreString(),
  coa: optionalFirestoreDate(),
  exa: optionalFirestoreDate(),
  uat: firestoreDate({ saveDefaultAsNow: true }),
  er: optionalFirestoreEnum<UserExternalConnectionErrorCode>()
};

/**
 * Field conversions for a {@link UserExternalConnectionLogin}.
 */
export const userExternalConnectionLoginFields = {
  ea: firestoreString(),
  l: optionalFirestoreString(),
  em: optionalFirestoreString(),
  emv: optionalFirestoreBoolean(),
  lat: firestoreDate({ saveDefaultAsNow: true }),
  uat: firestoreDate({ saveDefaultAsNow: true })
};

export const userExternalConnectionConverter = snapshotConverterFunctions<UserExternalConnection>({
  fields: {
    uid: firestoreUID(),
    e: firestoreObjectMap<UserExternalConnectionEntry, FirestoreModelData<UserExternalConnectionEntry>, UserExternalConnectionProviderType>({
      objectField: { fields: userExternalConnectionEntryFields }
    }),
    // an absent map decodes as {}, so every document written before `li` existed reads back as
    // "no login links" without a migration
    li: firestoreObjectMap<UserExternalConnectionLogin, FirestoreModelData<UserExternalConnectionLogin>, UserExternalConnectionProviderType>({
      objectField: { fields: userExternalConnectionLoginFields }
    }),
    c: firestoreEnumArray<UserExternalConnectionProviderType>(),
    ec: optionalFirestoreArray<UserExternalConnectionExternalAccountKey>(),
    uat: firestoreDate({ saveDefaultAsNow: true })
  }
});

/**
 * Copies the document id into `uid` on write, so the stored uid can never drift from the document id.
 */
export const userExternalConnectionAccessorFactory = copyUserRelatedDataAccessorFactoryFunction<UserExternalConnection>();

/**
 * Returns the root Firestore collection reference for UserExternalConnection documents.
 *
 * @param context - The FirestoreContext used to resolve the collection.
 * @returns A typed CollectionReference for the userExternalConnection collection.
 */
export function userExternalConnectionCollectionReference(context: FirestoreContext): CollectionReference<UserExternalConnection> {
  return context.collection(userExternalConnectionIdentity.collectionName);
}

export type UserExternalConnectionFirestoreCollection = FirestoreCollection<UserExternalConnection, UserExternalConnectionDocument>;

/**
 * Creates the Firestore collection accessor for UserExternalConnection documents.
 *
 * @param firestoreContext - The FirestoreContext used to build the collection.
 * @returns A UserExternalConnectionFirestoreCollection.
 */
export function userExternalConnectionFirestoreCollection(firestoreContext: FirestoreContext): UserExternalConnectionFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: userExternalConnectionIdentity,
    converter: userExternalConnectionConverter,
    accessorFactory: userExternalConnectionAccessorFactory,
    collection: userExternalConnectionCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new UserExternalConnectionDocument(accessor, documentAccessor),
    firestoreContext
  });
}
