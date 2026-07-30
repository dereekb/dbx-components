import { type EmailParticipantString, type WebsiteUrl } from '@dereekb/util';
import { Inject, Injectable } from '@nestjs/common';
import { MailgunServiceConfig } from './mailgun.config';
import { type MailgunSenderDomainString } from './mailgun';
import { type MailgunClient, type MailgunDomainsClient, type MailgunEventsClient, type MailgunMessagesClient, type MailgunSuppressionsClient, type MailgunValidationClient } from './mailgun.type';
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

  /**
   * The domain's suppression lists (bounces, spam complaints, unsubscribes, whitelists).
   *
   * An address on the bounce or complaint list is silently dropped by Mailgun on every subsequent send,
   * which makes this the first thing to check when diagnosing "this recipient stopped receiving email".
   *
   * @returns The suppressions client.
   */
  get suppressions(): MailgunSuppressionsClient {
    return this.client.suppressions;
  }

  /**
   * The domain's event log, used to inspect what actually happened to sent messages
   * (accepted/delivered/failed/rejected/complained/unsubscribed).
   *
   * @returns The events client.
   */
  get events(): MailgunEventsClient {
    return this.client.events;
  }

  /**
   * Single-address validation.
   *
   * @returns The validation client.
   */
  get validate(): MailgunValidationClient {
    return this.client.validate;
  }

  /**
   * Domain administration, used to read the sending domain's verification state.
   *
   * @returns The domains client.
   */
  get domains(): MailgunDomainsClient {
    return this.client.domains;
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
