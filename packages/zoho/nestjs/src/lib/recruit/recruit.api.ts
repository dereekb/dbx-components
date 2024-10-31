import { Inject, Injectable } from '@nestjs/common';
import { ZohoRecruit, ZohoRecruitContext, zohoRecruitFactory } from '@dereekb/zoho';
import { ZohoRecruitServiceConfig } from './recruit.config';
import { ZohoAccountsApi } from '../account/accounts.api';

@Injectable()
export class ZohoRecruitApi {
  public readonly zohoRecruit: ZohoRecruit;

  get recruitContext(): ZohoRecruitContext {
    return this.zohoRecruit.recruitContext;
  }

  constructor(@Inject(ZohoRecruitServiceConfig) public readonly config: ZohoRecruitServiceConfig, @Inject(ZohoAccountsApi) public readonly zohoAccountsApi: ZohoAccountsApi) {
    this.zohoRecruit = zohoRecruitFactory({
      ...config.factoryConfig,
      accountsContext: zohoAccountsApi.accountsContext
    })(config.zohoRecruit);
  }

  // MARK: Accessors
}
