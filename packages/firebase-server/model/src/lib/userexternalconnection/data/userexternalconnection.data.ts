import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import {
  AbstractFirestoreDocument,
  type CollectionReference,
  copyUserRelatedDataAccessorFactoryFunction,
  type FirestoreCollection,
  type FirestoreContext,
  firestoreDate,
  firestoreModelIdentity,
  firestoreUID,
  snapshotConverterFunctions,
  type UserExternalConnectionDataItemKey,
  type UserExternalConnectionDataTypeKey,
  type UserExternalConnectionDataValue,
  type UserExternalConnectionProviderType,
  type UserRelated,
  type UserRelatedById
} from '@dereekb/firebase';
import { firestoreEncryptedField } from '@dereekb/firebase-server';
import { type AES256GCMEncryptionSecretSource, deriveAES256GCMEncryptionSecret } from '@dereekb/nestjs';

// MARK: Identity
/**
 * Firestore model identity for {@link UserExternalConnectionData} documents.
 *
 * Server-only, like `uecp`: deliberately NO `firestore.rules` match block (the root catch-all denies every client),
 * no `@dbxModel` tag, no model service, and never on an app's shared `FirestoreCollections`. Data enters and leaves
 * only through the `userExternalConnection` `read:data` / `update:data` model API and the token mint's `?include=data`.
 */
export const userExternalConnectionDataIdentity = firestoreModelIdentity('userExternalConnectionData', 'uecd');

// MARK: Encryption
/**
 * HKDF `info` label used to derive the {@link UserExternalConnectionData} encryption key from the
 * `USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET` family secret.
 *
 * A separate key (rather than the family key itself) means a `uecp.cr` ciphertext copied into `uecd.d` does not
 * decrypt, so `read:data` can never be tricked into returning credentials. Versioned so a future scheme can coexist.
 *
 * Rotating the family secret orphans `uecd` documents exactly as it orphans `uecp` documents.
 */
export const USER_EXTERNAL_CONNECTION_DATA_ENCRYPTION_KEY_INFO = 'dbx-components/userExternalConnectionData/v1';

/**
 * Derives the {@link UserExternalConnectionData} encryption secret from the family secret.
 *
 * @param secret - The family secret (`USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET`).
 * @returns The derived 64-character hex secret.
 */
export function deriveUserExternalConnectionDataEncryptionSecret(secret: AES256GCMEncryptionSecretSource) {
  return deriveAES256GCMEncryptionSecret({ secret, info: USER_EXTERNAL_CONNECTION_DATA_ENCRYPTION_KEY_INFO });
}

// MARK: Types
/**
 * One stored item: the app-typed value and when it was set.
 *
 * The whole map is JSON round-tripped through the encrypted field, so the timestamp is an ISO string, not a `Date`.
 */
export interface UserExternalConnectionDataStoredItem {
  /**
   * The value.
   */
  readonly v: UserExternalConnectionDataValue;
  /**
   * When the item was last set.
   */
  readonly uat: ISO8601DateString;
}

/**
 * Stored items of one data type, keyed by item key.
 */
export type UserExternalConnectionStoredDataItems = Record<UserExternalConnectionDataItemKey, UserExternalConnectionDataStoredItem>;

/**
 * Stored data of one provider, keyed by data type.
 */
export type UserExternalConnectionStoredProviderData = Record<UserExternalConnectionDataTypeKey, UserExternalConnectionStoredDataItems>;

/**
 * providerType → dataType → itemKey → stored item.
 */
export type UserExternalConnectionStoredDataMap = Record<UserExternalConnectionProviderType, UserExternalConnectionStoredProviderData>;

/**
 * A user's stored external connection data: arbitrary, app-typed JSON keyed `providerType → dataType → itemKey`,
 * e.g. `microsoft → mail_signature → support@example.com → { html }`.
 *
 * Shares its document id (the user's uid) with the user's `UserExternalConnection`. Kept across a disconnect or
 * unlink (preferences survive a reconnect), deleted with the rest of the family by `deleteAllUserExternalConnectionsForUser`.
 *
 * Any future UI that renders a stored value (e.g. an HTML signature) must sanitize it.
 */
export interface UserExternalConnectionData extends UserRelated, UserRelatedById {
  /**
   * The data map, stored as ONE encrypted string covering the whole map (like `uecp.cr`). Never logged, and never
   * returned except through the API.
   */
  d: UserExternalConnectionStoredDataMap;
  /**
   * When this document was last written. Plain text.
   */
  uat: Date;
}

export class UserExternalConnectionDataDocument extends AbstractFirestoreDocument<UserExternalConnectionData, UserExternalConnectionDataDocument, typeof userExternalConnectionDataIdentity> {
  get modelIdentity() {
    return userExternalConnectionDataIdentity;
  }
}

// MARK: Converter
/**
 * Configuration for creating a {@link UserExternalConnectionData} snapshot converter.
 */
export interface UserExternalConnectionDataConverterConfig {
  /**
   * Encryption secret source for the data field. Normally derived with {@link deriveUserExternalConnectionDataEncryptionSecret}.
   */
  readonly encryptionSecret: AES256GCMEncryptionSecretSource;
}

/**
 * Creates a snapshot converter for {@link UserExternalConnectionData} documents.
 *
 * No `onDecodeFailure`: this is data of record, so an undecryptable document throws on read. The server actions map
 * that to `USER_EXTERNAL_CONNECTION_DATA_UNREADABLE_ERROR`, and an update with `clear: true` replaces it.
 *
 * @param config - Encryption configuration for the data field.
 * @returns Snapshot converter functions for UserExternalConnectionData documents.
 */
export function userExternalConnectionDataConverter(config: UserExternalConnectionDataConverterConfig) {
  return snapshotConverterFunctions<UserExternalConnectionData>({
    fields: {
      uid: firestoreUID(),
      d: firestoreEncryptedField<UserExternalConnectionStoredDataMap>({ secret: config.encryptionSecret, default: () => ({}) }),
      uat: firestoreDate({ saveDefaultAsNow: true })
    }
  });
}

/**
 * Copies the document id into `uid` on write, so the stored uid can never drift from the document id.
 */
export const userExternalConnectionDataAccessorFactory = copyUserRelatedDataAccessorFactoryFunction<UserExternalConnectionData>();

// MARK: Collection
/**
 * Returns the Firestore {@link CollectionReference} for {@link UserExternalConnectionData} documents.
 *
 * @param context - The Firestore context to create the collection reference from.
 * @returns The typed collection reference.
 */
export function userExternalConnectionDataCollectionReference(context: FirestoreContext): CollectionReference<UserExternalConnectionData> {
  return context.collection(userExternalConnectionDataIdentity.collectionName);
}

export type UserExternalConnectionDataFirestoreCollection = FirestoreCollection<UserExternalConnectionData, UserExternalConnectionDataDocument>;

/**
 * Configuration for creating a {@link UserExternalConnectionDataFirestoreCollection}.
 */
export interface UserExternalConnectionDataFirestoreCollectionConfig extends UserExternalConnectionDataConverterConfig {
  readonly firestoreContext: FirestoreContext;
}

/**
 * Creates a {@link UserExternalConnectionDataFirestoreCollection} with encrypted data support.
 *
 * @param config - Configuration including the Firestore context and encryption settings.
 * @returns The configured collection.
 */
export function userExternalConnectionDataFirestoreCollection(config: UserExternalConnectionDataFirestoreCollectionConfig): UserExternalConnectionDataFirestoreCollection {
  const { firestoreContext } = config;
  return firestoreContext.firestoreCollection({
    modelIdentity: userExternalConnectionDataIdentity,
    converter: userExternalConnectionDataConverter(config),
    accessorFactory: userExternalConnectionDataAccessorFactory,
    collection: userExternalConnectionDataCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new UserExternalConnectionDataDocument(accessor, documentAccessor),
    firestoreContext
  });
}

/**
 * Reference to a {@link UserExternalConnectionDataFirestoreCollection}.
 */
export interface UserExternalConnectionDataFirestoreCollectionRef {
  readonly userExternalConnectionDataCollection: UserExternalConnectionDataFirestoreCollection;
}

/**
 * Returns the stored provider data of a document, or undefined.
 *
 * @param data - The stored document value.
 * @param providerType - The provider.
 * @returns The provider's stored data, if any.
 */
export function userExternalConnectionStoredProviderData(data: Maybe<Pick<UserExternalConnectionData, 'd'>>, providerType: UserExternalConnectionProviderType): Maybe<UserExternalConnectionStoredProviderData> {
  return data?.d?.[providerType];
}
