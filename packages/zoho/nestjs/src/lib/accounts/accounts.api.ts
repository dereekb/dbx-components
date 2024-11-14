import { Inject, Injectable } from '@nestjs/common';
import { ZohoAccounts, ZohoAccountsContext, accessToken, zohoAccountsFactory } from '@dereekb/zoho';
import { ZohoAccountsServiceConfig } from './accounts.config';
import { ZohoAccountsAccessTokenCacheService } from './accounts.service';

@Injectable()
export class ZohoAccountsApi {
  readonly zohoAccounts: ZohoAccounts;

  get accountsContext(): ZohoAccountsContext {
    return this.zohoAccounts.accountsContext;
  }

  constructor(@Inject(ZohoAccountsServiceConfig) readonly config: ZohoAccountsServiceConfig, @Inject(ZohoAccountsAccessTokenCacheService) readonly cacheService: ZohoAccountsAccessTokenCacheService) {
    const accessTokenCache = config.zohoAccounts.accessTokenCache ? config.zohoAccounts.accessTokenCache : cacheService.loadZohoAccessTokenCache(config.zohoAccounts.serviceAccessTokenKey);
    this.zohoAccounts = zohoAccountsFactory(config.factoryConfig ?? {})({
      accessTokenCache,
      ...config.zohoAccounts
    });
  }

  // MARK: Accessors
  get accessToken() {
    return accessToken(this.accountsContext);
  }
}
