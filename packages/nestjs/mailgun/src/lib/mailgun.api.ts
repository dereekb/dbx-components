import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { MailgunServiceConfig } from './mailgun.config';
import { MailgunClient, MailgunMessagesClient } from './mailgun.type';
import MailgunClass from 'mailgun.js';

import * as FormData from 'form-data';

const Mailgun: typeof MailgunClass = require('mailgun.js'); // TODO: Check if we can import/use MailgunClass directly.

@Injectable()
export class MailgunApi {
  public readonly client: MailgunClient;

  constructor(@Inject(MailgunServiceConfig) public readonly config: MailgunServiceConfig) {
    this.client = new Mailgun(FormData).client({
      ...config.mailgun
    });
  }

  get messages(): MailgunMessagesClient {
    return this.client.messages;
  }

  get domain(): string {
    return this.config.domain;
  }

  get sender(): string {
    return this.config.sender;
  }
}
