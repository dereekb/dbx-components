import { ServerEnvironmentService } from '@dereekb/nestjs';
import { Injectable } from '@nestjs/common';
import { MailgunTemplateEmailRequest, MailgunEmailMessageSendResult, convertMailgunTemplateEmailRequestToMailgunMessageData } from './mailgun';
import { MailgunApi } from './mailgun.api';

@Injectable()
export class MailgunService {
  constructor(public readonly mailgunApi: MailgunApi, readonly serverEnvironmentService: ServerEnvironmentService) {}

  async sendTemplateEmail(request: MailgunTemplateEmailRequest): Promise<MailgunEmailMessageSendResult> {
    const domain = this.mailgunApi.domain;
    const sender = this.mailgunApi.sender;
    const testEnvironment = this.serverEnvironmentService.isTestingEnv;
    const { recipientVariablePrefix } = this.mailgunApi.config.messages;
    const data = convertMailgunTemplateEmailRequestToMailgunMessageData({ request, defaultSender: sender, recipientVariablePrefix, testEnvironment });

    let result;

    try {
      result = await this.mailgunApi.messages.create(domain, data);
    } catch (e) {
      console.error('Failed sending email: ', e);
      throw e;
    }

    return result;
  }
}
