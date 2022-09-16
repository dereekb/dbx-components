import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { MailgunTemplateEmailRequest, MailgunRecipient, MailgunUtility } from './mailgun';
import { MailgunApi } from './mailgun.api';

import * as FormData from 'form-data';

@Injectable()
export class MailgunService {
  constructor(public readonly mailgunApi: MailgunApi) {}

  async sendTemplateEmail(request: MailgunTemplateEmailRequest): Promise<any> {
    const domain = this.mailgunApi.domain;
    const sender = this.mailgunApi.sender;

    const from = request.from ? MailgunUtility.convertRecipientToString(request.from) : sender;
    const to = MailgunUtility.convertRecipientsToString(request.to);

    const data: Record<string, any> = {
      from,
      to,
      subject: request.subject,
      template: request.template,
      ...(request.templateVariables
        ? {
            'h:X-Mailgun-Variables': JSON.stringify(request.templateVariables)
          }
        : undefined)
    };

    let result;

    try {
      const formData: FormData = new FormData();

      Object.keys(data)
        .filter(function (key) {
          return data[key];
        })
        .forEach(function (key) {
          if (Array.isArray(data[key])) {
            data[key].forEach(function (item: any) {
              formData.append(key, item);
            });
          } else {
            formData.append(key, data[key]);
          }
        });

      const options: any = {
        headers: {
          ...formData.getHeaders()
        }
      };

      // console.log('Data: ', data, formData, options);

      const url = `/v3/${domain}/messages`;
      const commandPromise = this.mailgunApi.messages.request.command('post', url, formData, options); // this.mailgunApi.messages.create(domain, data);

      result = await commandPromise;
    } catch (e) {
      console.error('Failed sending email: ', e);
      throw e;
    }

    return result;
  }
}
