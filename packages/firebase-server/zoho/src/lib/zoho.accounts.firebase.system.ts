import { type ZohoAccessToken, type ZohoServiceAccessTokenKey } from '@dereekb/zoho';
import { type FirestoreDocument, type FirestoreDocumentAccessor, type FirestoreModelFieldMapFunctionsConfig, type SystemState, type SystemStateDocument, type SystemStateStoredData, type SystemStateStoredDataFieldConverterConfig, firestoreDate, firestoreNumber, firestoreObjectArray, firestoreString, firestoreSubObject } from '@dereekb/firebase';
import { firestoreEncryptedField } from '@dereekb/firebase-server';
import { type AES256GCMEncryptionSecretSource } from '@dereekb/nestjs';
import { type Configurable, filterUniqueFunction, isPast } from '@dereekb/util';

/**
 * {@link SystemState} type identifier for storing Zoho access tokens in Firestore.
 */
export const ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE = 'zoho_access_token';

/**
 * Represents a single Zoho access token stored within the {@link SystemState} document,
 * keyed by the service access token key to support multiple Zoho service integrations.
 */
export interface ZohoAccessTokenSystemStateEmbeddedToken extends Configurable<ZohoAccessToken> {
  /**
   * The access token key
   */
  key: ZohoServiceAccessTokenKey;
}

/**
 * Configuration for the encrypted Zoho access token converters.
 */
export interface ZohoAccessTokenSystemStateDataConverterConfig {
  /**
   * Encryption secret source for the `accessToken` field.
   */
  readonly encryptionSecret: AES256GCMEncryptionSecretSource;
}

/**
 * Creates the embedded-token converter, encrypting the `accessToken` at rest.
 *
 * This is a factory rather than a module-level const because `firestoreEncryptedField` resolves and
 * validates the encryption key eagerly at construction — the secret must be known at runtime.
 *
 * ONLY `accessToken` is encrypted, deliberately. `firestoreEncryptedField` round-trips through
 * `JSON.stringify`/`JSON.parse`, so anything placed inside the encrypted blob loses its type — and
 * `expiresAt` is a `Date`. Encrypting the token string alone keeps every date outside the blob,
 * which is what lets {@link zohoAccessTokenSystemStateDataConverterFactory} keep filtering expired
 * entries without having to decrypt them first. Do not "improve" this by encrypting the whole
 * token object or the `tokens` array.
 *
 * Accepted trade-off: `key`, `scope`, `apiDomain`, `expiresIn` and `expiresAt` remain plaintext at
 * rest. None of them is a credential.
 *
 * @param config - The encryption configuration.
 * @returns The embedded token field converter.
 */
export function zohoAccessTokenSystemStateEmbeddedTokenConverterFactory(config: ZohoAccessTokenSystemStateDataConverterConfig): FirestoreModelFieldMapFunctionsConfig<ZohoAccessTokenSystemStateEmbeddedToken, any> {
  return firestoreSubObject<ZohoAccessTokenSystemStateEmbeddedToken>({
    objectField: {
      fields: {
        key: firestoreString(),
        accessToken: firestoreEncryptedField<string>({
          secret: config.encryptionSecret,
          default: '',
          // This is a cache of ~1h tokens, so an undecryptable entry is a cache MISS, not an error.
          // The empty sentinel is dropped by the `tokens` filter, and the next Zoho call re-mints.
          // This is also what makes a rotated secret survivable here (unlike uecp/jwks).
          onDecodeFailure: () => ''
        }),
        scope: firestoreString(),
        apiDomain: firestoreString(),
        expiresIn: firestoreNumber({ default: 3600 }),
        expiresAt: firestoreDate()
      }
    }
  });
}

/**
 * Data shape stored within a {@link SystemState} document for caching multiple Zoho access tokens.
 *
 * Expired tokens are automatically filtered out during Firestore read via the converter,
 * and only one token per service key is retained (enforced by {@link filterUniqueFunction}).
 */
export interface ZohoAccessTokenSystemStateData extends SystemStateStoredData {
  /**
   * The array of cached access tokens, one per Zoho service integration.
   */
  tokens: ZohoAccessTokenSystemStateEmbeddedToken[];
  /**
   * Timestamp of the last token update.
   */
  lat: Date;
}

/**
 * Firestore field converter for {@link ZohoAccessTokenSystemStateData}.
 *
 * Automatically filters out expired tokens on read and enforces uniqueness by service key.
 * Must be registered in the app's {@link SystemStateStoredDataConverterMap} under
 * the {@link ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE} key.
 */
/**
 * Builds the {@link ZohoAccessTokenSystemStateData} converter around a given embedded-token converter.
 *
 * Shared by the encrypted factory and the deprecated plaintext const so the array's expiry filter and
 * per-key dedup behavior can only ever be defined once.
 *
 * @param embeddedTokenConverter - The converter for each entry in the `tokens` array.
 * @returns The stored-data field converter.
 */
function zohoAccessTokenSystemStateDataConverterForEmbeddedTokenConverter(embeddedTokenConverter: FirestoreModelFieldMapFunctionsConfig<ZohoAccessTokenSystemStateEmbeddedToken, any>): SystemStateStoredDataFieldConverterConfig<ZohoAccessTokenSystemStateData> {
  return firestoreSubObject<ZohoAccessTokenSystemStateData>({
    objectField: {
      fields: {
        tokens: firestoreObjectArray({
          firestoreField: embeddedTokenConverter,
          filterUnique: filterUniqueFunction((x) => x.key), // only one token per key is allowed

          // `firestoreObjectArray` maps BEFORE it filters, so this runs on already-decoded entries.
          // The `accessToken` check is what drops an entry whose decryption failed (onDecodeFailure
          // leaves an empty string behind) — without it such an entry would surface as a token with
          // an empty secret rather than as a cache miss.
          filter: (x) => Boolean(x?.accessToken) && (x?.expiresAt ? !isPast(x.expiresAt) : true) // filter out empty/expired values
        }),
        lat: firestoreDate({ saveDefaultAsNow: true })
      }
    }
  });
}

/**
 * Creates the {@link ZohoAccessTokenSystemStateData} converter, encrypting each token's
 * `accessToken` at rest.
 *
 * Register the result in a SERVER-ONLY converter map under {@link ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE} —
 * see `systemStatePrivateFirestoreCollection()` in `@dereekb/firebase-server/model`. It must never be
 * registered in an app's client-shared `SystemStateStoredDataConverterMap`.
 *
 * @param config - The encryption configuration.
 * @returns The stored-data field converter.
 */
export function zohoAccessTokenSystemStateDataConverterFactory(config: ZohoAccessTokenSystemStateDataConverterConfig): SystemStateStoredDataFieldConverterConfig<ZohoAccessTokenSystemStateData> {
  return zohoAccessTokenSystemStateDataConverterForEmbeddedTokenConverter(zohoAccessTokenSystemStateEmbeddedTokenConverterFactory(config));
}

/**
 * Loads the {@link SystemStateDocument} that stores {@link ZohoAccessTokenSystemStateData},
 * using {@link ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE} as the document ID.
 *
 * @param accessor - The document accessor for the SystemState collection.
 * @returns The SystemState document for the Zoho access token data.
 *
 * @example
 * ```ts
 * const doc = loadZohoAccessTokenSystemState(systemStateCollection.documentAccessor());
 * const data = await doc.snapshotData();
 * ```
 */
export function loadZohoAccessTokenSystemState<D extends FirestoreDocument<SystemState<SystemStateStoredData>>>(accessor: FirestoreDocumentAccessor<SystemState<SystemStateStoredData>, D>): SystemStateDocument<ZohoAccessTokenSystemStateData> {
  return accessor.loadDocumentForId(ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE) as unknown as SystemStateDocument<ZohoAccessTokenSystemStateData>;
}

// COMPAT: Deprecated aliases
/**
 * @deprecated stores the access token in PLAINTEXT. Use
 * {@link zohoAccessTokenSystemStateEmbeddedTokenConverterFactory} instead, which encrypts it at rest.
 */
export const zohoAccessTokenSystemStateEmbeddedTokenConverter = firestoreSubObject<ZohoAccessTokenSystemStateEmbeddedToken>({
  objectField: {
    fields: {
      key: firestoreString(),
      accessToken: firestoreString(),
      scope: firestoreString(),
      apiDomain: firestoreString(),
      expiresIn: firestoreNumber({ default: 3600 }),
      expiresAt: firestoreDate()
    }
  }
});

/**
 * @deprecated stores access tokens in PLAINTEXT. Use {@link zohoAccessTokenSystemStateDataConverterFactory}
 * instead, and register it on a server-only SystemStatePrivate collection.
 */
export const zohoAccessTokenSystemStateDataConverter: SystemStateStoredDataFieldConverterConfig<ZohoAccessTokenSystemStateData> = zohoAccessTokenSystemStateDataConverterForEmbeddedTokenConverter(zohoAccessTokenSystemStateEmbeddedTokenConverter);
