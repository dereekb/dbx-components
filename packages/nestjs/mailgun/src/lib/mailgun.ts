import { ArrayOrValue, EmailAddress, EmailAddressDomain, NameEmailPair } from '@dereekb/util';
import APIResponse from 'mailgun.js/interfaces/ApiResponse';
import { MailgunMessageData, MessagesSendResult } from 'mailgun.js/interfaces/Messages';

export type MailgunSenderDomainString = EmailAddressDomain;
export type MailgunTemplateKey = string;

export interface MailgunRecipient extends NameEmailPair {}

export interface MailgunEmailRequest {
  from?: MailgunRecipient;
  to: ArrayOrValue<MailgunRecipient>;
  subject: string;
}

export interface MailgunTemplateEmailParameters {
  /**
   * Mailgun template name.
   */
  template: MailgunTemplateKey;
  /**
   * Template variables. Each value is converted to a JSON string before being sent to Mailgun server.
   */
  templateVariables?: Record<string, any>;
  /**
   * Sends a test email to the Mailgun API
   */
  testEmail?: boolean;
}

export interface MailgunTemplateEmailRequest extends MailgunEmailRequest, MailgunTemplateEmailParameters {
  /**
   * Apply custom parameters directly.
   */
  messageData?: Partial<MailgunMessageData>;
}

export type MailgunEmailMessageSendResult = MessagesSendResult;
export type MailgunAPIResponse = APIResponse;

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
