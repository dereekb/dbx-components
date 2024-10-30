import { Maybe } from '@dereekb/util';
import { Inject, Injectable, BadRequestException, InjectionToken } from '@nestjs/common';
import { ZohoAccessToken, ZohoAccessTokenCache, ZohoServiceAccessTokenKey } from '@dereekb/zoho';

/**
 * Service used for retrieving ZohoAccessTokenCache for Zoho services.
 */
@Injectable()
export abstract class ZohoAccountsAccessTokenCacheService {
  /**
   * Loads an ZohoAccessTokenCache for the given service key.
   *
   * @param service
   */
  abstract loadZohoAccessTokenCache(service: ZohoServiceAccessTokenKey): ZohoAccessTokenCache;
}
