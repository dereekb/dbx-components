import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { AbstractFirestoreDocument, type CollectionReference, copyUserRelatedDataAccessorFactoryFunction, type FirebaseAuthUserId, type FirestoreCollection, type FirestoreContext, firestoreDate, firestoreModelIdentity, firestoreUID, snapshotConverterFunctions, type UserExternalConnectionCapability, type UserExternalConnectionExternalAccountId, type UserExternalConnectionGrantSummary, type UserExternalConnectionProviderType, type UserRelated, type UserRelatedById } from '@dereekb/firebase';
import { firestoreEncryptedField } from '@dereekb/firebase-server';
import { type AES256GCMEncryptionSecretSource } from '@dereekb/nestjs';

// MARK: Collections
/**
 * Provides access to the {@link UserExternalConnectionPrivate} collection.
 *
 * Provided ONLY by the UserExternalConnectionModule. This is deliberately never declared on an
 * app's shared `FirestoreCollections` class: `provideAppFirestoreCollections()` hard-codes a
 * `(context: FirestoreContext) => T` factory, which cannot carry the encryption secret this
 * collection's converter needs — so the private collection structurally cannot leak into the
 * client-shared collection set.
 */
export abstract class UserExternalConnectionServerFirestoreCollections {
  abstract readonly userExternalConnectionPrivateCollection: UserExternalConnectionPrivateFirestoreCollection;
}

// MARK: Identity
/**
 * Firestore model identity for {@link UserExternalConnectionPrivate} documents.
 *
 * This is a server-side only model. It has no provisions for client-side access, and deliberately
 * has NO `firestore.rules` match block — the root catch-all `allow read, write: if false;` is what
 * denies every client, and a block here would only create an opportunity to grant access by accident.
 */
export const userExternalConnectionPrivateIdentity = firestoreModelIdentity('userExternalConnectionPrivate', 'uecp');

// MARK: Types
/**
 * Credentials granted by a third-party provider for a single user.
 *
 * NOTE: every timestamp here is an {@link ISO8601DateString}, NOT a `Date`. The whole credentials
 * map is JSON round-tripped through `encryptValue`/`decryptValue`, so a `Date` would silently come
 * back as a string.
 */
export interface UserExternalConnectionCredentials {
  readonly accessToken: string;
  readonly refreshToken?: Maybe<string>;
  readonly tokenType?: Maybe<string>;
  readonly issuedAt: ISO8601DateString;
  readonly expiresAt?: Maybe<ISO8601DateString>;
  readonly scopes?: Maybe<UserExternalConnectionCapability[]>;
  readonly externalAccountId?: Maybe<UserExternalConnectionExternalAccountId>;
  readonly label?: Maybe<string>;
  /**
   * Any additional provider-specific values that must be retained to use the credentials.
   */
  readonly extra?: Maybe<Record<string, Maybe<string | number | boolean>>>;
}

/**
 * Map of provider type to the credentials stored for that provider.
 */
export type UserExternalConnectionCredentialsMap = Record<UserExternalConnectionProviderType, UserExternalConnectionCredentials>;

/**
 * The server-only half of a user's third-party OAuth connection state.
 *
 * Shares its document id (the user's uid) with the client-readable `UserExternalConnection` in
 * `@dereekb/firebase`, and is only ever written in the same transaction as it. See
 * `writeUserExternalConnectionPairInTransactionFactory`.
 */
export interface UserExternalConnectionPrivate extends UserRelated, UserRelatedById {
  /**
   * Per-provider credentials. Stored as ONE encrypted string covering the whole map.
   *
   * A single encrypted field rather than a map of encrypted values: there is no server-side need to
   * query inside credentials, and one field keeps the whole blob atomic with the paired write.
   */
  cr: UserExternalConnectionCredentialsMap;
  /**
   * Date this document was last updated at.
   */
  uat: Date;
}

export class UserExternalConnectionPrivateDocument extends AbstractFirestoreDocument<UserExternalConnectionPrivate, UserExternalConnectionPrivateDocument, typeof userExternalConnectionPrivateIdentity> {
  get modelIdentity() {
    return userExternalConnectionPrivateIdentity;
  }
}

// MARK: Converter
/**
 * Configuration for creating a {@link UserExternalConnectionPrivate} snapshot converter.
 */
export interface UserExternalConnectionPrivateConverterConfig {
  /**
   * Encryption secret source for the credentials field.
   */
  readonly encryptionSecret: AES256GCMEncryptionSecretSource;
}

/**
 * Creates a snapshot converter for {@link UserExternalConnectionPrivate} documents.
 *
 * This is a factory rather than a module-level const because `firestoreEncryptedField` resolves and
 * validates the encryption key eagerly at construction — the secret must be known at runtime.
 *
 * @param config - Encryption configuration for the credentials field.
 * @returns Snapshot converter functions for UserExternalConnectionPrivate documents.
 */
export function userExternalConnectionPrivateConverter(config: UserExternalConnectionPrivateConverterConfig) {
  return snapshotConverterFunctions<UserExternalConnectionPrivate>({
    fields: {
      uid: firestoreUID(),
      cr: firestoreEncryptedField<UserExternalConnectionCredentialsMap>({ secret: config.encryptionSecret, default: () => ({}) }),
      uat: firestoreDate({ saveDefaultAsNow: true })
    }
  });
}

/**
 * Copies the document id into `uid` on write, so the stored uid can never drift from the document id.
 */
export const userExternalConnectionPrivateAccessorFactory = copyUserRelatedDataAccessorFactoryFunction<UserExternalConnectionPrivate>();

// MARK: Collection
/**
 * Returns the Firestore {@link CollectionReference} for {@link UserExternalConnectionPrivate} documents.
 *
 * @param context - The Firestore context to create the collection reference from.
 * @returns The typed collection reference.
 */
export function userExternalConnectionPrivateCollectionReference(context: FirestoreContext): CollectionReference<UserExternalConnectionPrivate> {
  return context.collection(userExternalConnectionPrivateIdentity.collectionName);
}

export type UserExternalConnectionPrivateFirestoreCollection = FirestoreCollection<UserExternalConnectionPrivate, UserExternalConnectionPrivateDocument>;

/**
 * Configuration for creating a {@link UserExternalConnectionPrivateFirestoreCollection}.
 */
export interface UserExternalConnectionPrivateFirestoreCollectionConfig extends UserExternalConnectionPrivateConverterConfig {
  readonly firestoreContext: FirestoreContext;
}

/**
 * Creates a {@link UserExternalConnectionPrivateFirestoreCollection} with encrypted credentials support.
 *
 * @param config - Configuration including the Firestore context and encryption settings.
 * @returns The configured collection.
 */
export function userExternalConnectionPrivateFirestoreCollection(config: UserExternalConnectionPrivateFirestoreCollectionConfig): UserExternalConnectionPrivateFirestoreCollection {
  const { firestoreContext } = config;
  return firestoreContext.firestoreCollection({
    modelIdentity: userExternalConnectionPrivateIdentity,
    converter: userExternalConnectionPrivateConverter(config),
    accessorFactory: userExternalConnectionPrivateAccessorFactory,
    collection: userExternalConnectionPrivateCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new UserExternalConnectionPrivateDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Utility
/**
 * Projects the client-readable facts out of a set of credentials.
 *
 * This is the ONLY bridge between the private and public halves of the pair. Because the summary
 * entry is derived from this projection, the public document cannot describe scopes, an account, or
 * an expiration that the credentials do not actually carry.
 *
 * @param credentials - The credentials to project.
 * @returns The grant summary the public entry is derived from.
 */
export function userExternalConnectionGrantSummaryFromCredentials(credentials: UserExternalConnectionCredentials): UserExternalConnectionGrantSummary {
  return {
    scopes: credentials.scopes,
    externalAccountId: credentials.externalAccountId,
    label: credentials.label,
    connectedAt: credentials.issuedAt ? new Date(credentials.issuedAt) : null,
    expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null
  };
}

/**
 * Input for {@link applyUserExternalConnectionCredentials}.
 */
export interface ApplyUserExternalConnectionCredentialsInput {
  /**
   * The currently stored private document, when one exists.
   */
  readonly current?: Maybe<UserExternalConnectionPrivate>;
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The next credentials for this provider, or null to remove the provider's key entirely.
   */
  readonly credentials: Maybe<UserExternalConnectionCredentials>;
  readonly now: Date;
}

/**
 * Applies a single provider's credentials and returns the COMPLETE next private document.
 *
 * The counterpart of `applyUserExternalConnectionEntry()` — both are always called with the same
 * provider and instant inside one transaction.
 *
 * @param input - The current document plus the credentials to apply.
 * @returns The next UserExternalConnectionPrivate value to write.
 */
export function applyUserExternalConnectionCredentials(input: ApplyUserExternalConnectionCredentialsInput): UserExternalConnectionPrivate {
  const { current, uid, providerType, credentials, now } = input;
  const nextCredentials: UserExternalConnectionCredentialsMap = { ...current?.cr };

  if (credentials) {
    nextCredentials[providerType] = credentials;
  } else {
    delete nextCredentials[providerType];
  }

  return {
    uid,
    cr: nextCredentials,
    uat: now
  };
}
