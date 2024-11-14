import { Inject, Injectable } from '@nestjs/common';
import { MailgunServiceConfig } from './mailgun.config';
import { MailgunClient, MailgunMessagesClient } from './mailgun.type';
import Mailgun from 'mailgun.js';

import * as FormData from 'form-data';

@Injectable()
export class MailgunApi {
  readonly client: MailgunClient;

  constructor(@Inject(MailgunServiceConfig) readonly config: MailgunServiceConfig) {
    this.client = new Mailgun(FormData).client({
      ...config.mailgun
    });
  }

  get messages(): MailgunMessagesClient {
    return this.client.messages;
  }

  get clientUrl(): string {
    return this.config.clientUrl;
  }

  get domain(): string {
    return this.config.domain;
  }

  get sender(): string {
    return this.config.sender;
  }
}
