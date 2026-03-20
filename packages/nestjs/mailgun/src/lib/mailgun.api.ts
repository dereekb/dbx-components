import { type EmailParticipantString, type WebsiteUrl } from '@dereekb/util';
import { Inject, Injectable } from '@nestjs/common';
import { MailgunServiceConfig } from './mailgun.config';
import { type MailgunSenderDomainString } from './mailgun';
import { type MailgunClient, type MailgunMessagesClient } from './mailgun.type';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';

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

  get clientUrl(): WebsiteUrl {
    return this.config.clientUrl;
  }

  get domain(): MailgunSenderDomainString {
    return this.config.domain;
  }

  get sender(): EmailParticipantString {
    return this.config.sender;
  }
}
