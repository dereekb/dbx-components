import { EmailAddress, EmailAddressDomain, NameEmailPair } from '@dereekb/util';

export type MailgunSenderDomainString = EmailAddressDomain;
export type MailgunTemplateKey = string;

export interface MailgunRecipient extends NameEmailPair {}

export interface MailgunEmailRequest {
  from?: MailgunRecipient;
  to: MailgunRecipient[];
  subject: string;
}

export interface MailgunTemplateEmailParameters {
  /**
   * Mailgun template name.
   */
  template: MailgunTemplateKey;
  /**
   * Template variables.
   */
  templateVariables?: Record<string, any>;
}

export interface MailgunTemplateEmailRequest extends MailgunEmailRequest, MailgunTemplateEmailParameters {}

export class MailgunUtility {
  static convertRecipientsToString(recipients: MailgunRecipient[]): string {
    const recipientStrings = recipients.map((x) => MailgunUtility.convertRecipientToString(x));
    return recipientStrings.join(',');
  }

  static convertRecipientToString(recipient: MailgunRecipient): string {
    let address = recipient.email;

    if (recipient.name) {
      address = `${recipient.name} <${address}>`;
    }

    return address;
  }
}
