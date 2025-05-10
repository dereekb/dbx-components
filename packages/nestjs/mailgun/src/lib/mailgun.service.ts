import { ServerEnvironmentService } from '@dereekb/nestjs';
import { Injectable } from '@nestjs/common';
import { MailgunTemplateEmailRequest, MailgunEmailMessageSendResult, convertMailgunTemplateEmailRequestToMailgunMessageData } from './mailgun';
import { MailgunApi } from './mailgun.api';

@Injectable()
export class MailgunService {

  private readonly _mailgunApi: MailgunApi;
  private readonly _serverEnvironmentService: ServerEnvironmentService;

  constructor(mailgunApi: MailgunApi, serverEnvironmentService: ServerEnvironmentService) {
    this._mailgunApi = mailgunApi;
    this._serverEnvironmentService = serverEnvironmentService;
  }

  get mailgunApi() {
    return this._mailgunApi;
  }

  get serverEnvironmentService() {
    return this._serverEnvironmentService;
  }

  async sendTemplateEmail(request: MailgunTemplateEmailRequest): Promise<MailgunEmailMessageSendResult> {
    const domain = this.mailgunApi.domain;
    const sender = this.mailgunApi.sender;
    const isTestingEnvironment = this.serverEnvironmentService.isTestingEnv;
    const { recipientVariablePrefix } = this.mailgunApi.config.messages;
    const data = convertMailgunTemplateEmailRequestToMailgunMessageData({ request, defaultSender: sender, recipientVariablePrefix, isTestingEnvironment });

    let result: MailgunEmailMessageSendResult;

    const shouldSend = !isTestingEnvironment || request.sendTestEmails || this.mailgunApi.config.messages.sendTestEmails;

    if (shouldSend) {
      try {
        result = await this.mailgunApi.messages.create(domain, data);
      } catch (e) {
        console.error('Failed sending email: ', e);
        throw e;
      }
    } else {
      result = {
        status: 200,
        message: 'Success. Env prevented sending email.'
      };
    }

    return result;
  }
}

/**
 * Provides a reference to a MailgunService instance.
 */
export interface MailgunServiceRef {
  readonly mailgunService: MailgunService;
}
