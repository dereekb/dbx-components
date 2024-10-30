import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { ZohoRecruit, ZohoRecruitContext, zohoRecruitFactory } from '@dereekb/zoho';
import { ZohoRecruitServiceConfig } from './recruit.config';
import { WebsiteUrl } from '@dereekb/util';
import { Request } from 'express';

@Injectable()
export class ZohoRecruitApi {
  public readonly zohoRecruit: ZohoRecruit;

  get recruitContext(): ZohoRecruitContext {
    return this.zohoRecruit.recruitContext;
  }

  constructor(@Inject(ZohoRecruitServiceConfig) public readonly config: ZohoRecruitServiceConfig) {
    this.zohoRecruit = zohoRecruitFactory(config.factoryConfig ?? {})(config.zohoRecruit);
  }
}
