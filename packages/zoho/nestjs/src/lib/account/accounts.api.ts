import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { ZohoAccounts, ZohoAccountsContext, zohoAccountsFactory } from '@dereekb/zoho';
import { ZohoAccountsServiceConfig } from './accounts.config';
import { WebsiteUrl } from '@dereekb/util';
import { Request } from 'express';

@Injectable()
export class ZohoAccountsApi {
  public readonly zohoAccounts: ZohoAccounts;

  get accountsContext(): ZohoAccountsContext {
    return this.zohoAccounts.accountsContext;
  }

  constructor(@Inject(ZohoAccountsServiceConfig) public readonly config: ZohoAccountsServiceConfig) {
    this.zohoAccounts = zohoAccountsFactory(config.factoryConfig ?? {})(config.zohoAccounts);
  }
}
