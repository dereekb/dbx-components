import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { MailgunTemplateEmailRequest, MailgunRecipient, MailgunUtility, MailgunEmailMessageSendResult } from './mailgun';
import { MailgunApi } from './mailgun.api';
import { asArray, filterKeyValueTuplesFunction, forEachKeyValue } from '@dereekb/util';

import { MailgunMessageData } from 'mailgun.js/interfaces/Messages';

@Injectable()
export class MailgunService {
  constructor(public readonly mailgunApi: MailgunApi) {}

  async sendTemplateEmail(request: MailgunTemplateEmailRequest): Promise<MailgunEmailMessageSendResult> {
    const domain = this.mailgunApi.domain;
    const sender = this.mailgunApi.sender;

    const from = request.from ? MailgunUtility.convertRecipientToString(request.from) : sender;
    const to = MailgunUtility.convertRecipientsToString(asArray(request.to));

    const data: MailgunMessageData = {
      from,
      to,
      subject: request.subject,
      template: request.template,
      ...request.messageData
    };

    if (request.testEmail) {
      data['o:testmode'] = true;
    }

    if (request.templateVariables) {
      forEachKeyValue(request.templateVariables, {
        forEach: (x) => {
          const [key, value] = x;
          data[`v:${key}`] = JSON.stringify(value);
        }
      });
    }

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
