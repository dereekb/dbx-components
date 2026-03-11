import { type ZohoAccessToken, type ZohoServiceAccessTokenKey } from '@dereekb/zoho';
import { type FirestoreDocumentAccessor, type SystemState, type SystemStateDocument, type SystemStateStoredData, type SystemStateStoredDataFieldConverterConfig, firestoreDate, firestoreNumber, firestoreObjectArray, firestoreString, firestoreSubObject } from '@dereekb/firebase';
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
export const zohoAccessTokenSystemStateDataConverter: SystemStateStoredDataFieldConverterConfig<ZohoAccessTokenSystemStateData> = firestoreSubObject<ZohoAccessTokenSystemStateData>({
  objectField: {
    fields: {
      tokens: firestoreObjectArray({
        firestoreField: zohoAccessTokenSystemStateEmbeddedTokenConverter,
        filterUnique: filterUniqueFunction((x) => x.key), // only one token per key is allowed
        filter: (x) => (x?.expiresAt ? !isPast(x.expiresAt) : true) // filter out expired values or values that have no expiration
      }),
      lat: firestoreDate({ saveDefaultAsNow: true })
    }
  }
});

/**
 * Loads the {@link SystemStateDocument} that stores {@link ZohoAccessTokenSystemStateData},
 * using {@link ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE} as the document ID.
 *
 * @param accessor - the document accessor for the SystemState collection
 *
 * @example
 * ```ts
 * const doc = loadZohoAccessTokenSystemState(systemStateCollection.documentAccessor());
 * const data = await doc.snapshotData();
 * ```
 */
export function loadZohoAccessTokenSystemState(accessor: FirestoreDocumentAccessor<SystemState<SystemStateStoredData>, SystemStateDocument<SystemStateStoredData>>): SystemStateDocument<ZohoAccessTokenSystemStateData> {
  return accessor.loadDocumentForId(ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE) as SystemStateDocument<ZohoAccessTokenSystemStateData>;
}
