import { ZohoAccessToken, ZohoServiceAccessTokenKey } from '@dereekb/zoho';
import { FirestoreDocumentAccessor, SystemState, SystemStateDocument, SystemStateFirestoreCollection, SystemStateStoredData, SystemStateStoredDataFieldConverterConfig, firestoreArray, firestoreDate, firestoreNumber, firestoreObjectArray, firestoreString, firestoreSubObject } from '@dereekb/firebase';
import { Configurable, filterUniqueFunction, isPast } from '@dereekb/util';
import { filterUnique } from '@dereekb/rxjs';

export const ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE = 'zoho_access_token';

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

export interface ZohoAccessTokenSystemStateData extends SystemStateStoredData {
  /**
   * The array of access tokens
   */
  tokens: ZohoAccessTokenSystemStateEmbeddedToken[];
  /**
   * Last updated at
   */
  lat: Date;
}

/**
 * NOTE: Be sure to register this data converter with the SystemStateStoredDataConverterMap for your app.
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
 * Convenience function for loading the document for ZohoAccessTokenSystemStateData.
 *
 * @param accessor
 * @returns
 */
export function loadZohoAccessTokenSystemState(accessor: FirestoreDocumentAccessor<SystemState<SystemStateStoredData>, SystemStateDocument<SystemStateStoredData>>): SystemStateDocument<ZohoAccessTokenSystemStateData> {
  return accessor.loadDocumentForId(ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE) as SystemStateDocument<ZohoAccessTokenSystemStateData>;
}
