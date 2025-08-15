import { type SystemState, type SystemStateFirestoreCollection } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type ZohoAccessToken, type ZohoAccessTokenCache } from '@dereekb/zoho';
import { type ZohoAccountsAccessTokenCacheService } from '@dereekb/zoho/nestjs';
import { type ZohoAccessTokenSystemStateData, loadZohoAccessTokenSystemState } from './zoho.accounts.firebase.system';

/**
 * Creates a ZohoAccountsAccessTokenCacheService from the input SystemStateFirestoreCollection.
 *
 * @param collection
 */
export function firebaseZohoAccountsAccessTokenCacheService(systemStateCollection: SystemStateFirestoreCollection): ZohoAccountsAccessTokenCacheService {
  const systemStateDocumentAccessor = systemStateCollection.documentAccessor();

  const service: ZohoAccountsAccessTokenCacheService = {
    loadZohoAccessTokenCache: function (serviceKey: string): ZohoAccessTokenCache {
      const cache: ZohoAccessTokenCache = {
        loadCachedToken: async function (): Promise<Maybe<ZohoAccessToken>> {
          const document = loadZohoAccessTokenSystemState(systemStateDocumentAccessor);
          const existingData = await document.snapshotData();

          let result: Maybe<ZohoAccessToken> = null;

          if (existingData != null) {
            const tokensArray = existingData?.data?.tokens ?? [];
            result = tokensArray.find((x) => x.key === serviceKey);
          }

          return result;
        },
        updateCachedToken: async function (accessToken: ZohoAccessToken): Promise<void> {
          // run in a transaction
          await systemStateCollection.firestoreContext.runTransaction(async (transaction) => {
            const documentInTransaction = loadZohoAccessTokenSystemState(systemStateCollection.documentAccessorForTransaction(transaction));
            const existingData = await documentInTransaction.snapshotData();
            const existingTokens = existingData?.data?.tokens ?? [];

            const tokens = [
              // filter any potential old token for this service key
              ...existingTokens.filter((x) => x.key !== serviceKey),
              // add the new token
              {
                ...accessToken,
                key: serviceKey
              }
            ];

            const templateOrUpdate: SystemState<ZohoAccessTokenSystemStateData> = {
              data: {
                tokens,
                lat: new Date()
              }
            };

            // create/update depending on the current document's existence
            if (!existingData) {
              await documentInTransaction.create(templateOrUpdate);
            } else {
              await documentInTransaction.update(templateOrUpdate);
            }
          });
        },
        clearCachedToken: async function (): Promise<void> {
          await systemStateCollection.firestoreContext.runTransaction(async (transaction) => {
            const documentInTransaction = loadZohoAccessTokenSystemState(systemStateCollection.documentAccessorForTransaction(transaction));
            const existingData = await documentInTransaction.snapshotData();

            const templateOrUpdate: SystemState<ZohoAccessTokenSystemStateData> = {
              data: {
                tokens: [],
                lat: new Date()
              }
            };

            // clear the tokens
            if (existingData) {
              await documentInTransaction.update(templateOrUpdate);
            }
          });
        }
      };

      return cache;
    }
  };

  return service;
}
