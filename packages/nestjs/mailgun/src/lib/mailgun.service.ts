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
