import { isTestNodeEnv } from '@dereekb/nestjs';
import { type ArrayOrValue, asArray, type EmailAddress, type EmailAddressDomain, forEachKeyValue, KeyValueTypleValueFilter, type NameEmailPair, overrideInObject, objectIsEmpty, type EmailParticipantString, addToSet, forEachInIterable, type Maybe } from '@dereekb/util';
import { type APIResponse } from 'mailgun.js/Types/Common/ApiResponse';
import { type CustomFile, type CustomFileData, type MailgunMessageData, type MessagesSendResult } from 'mailgun.js/Types/Messages/Messages';

export type MailgunSenderDomainString = EmailAddressDomain;
export type MailgunTemplateKey = string;

export interface MailgunRecipient extends NameEmailPair {
  readonly userVariables?: Record<string, any>;
}

export interface MailgunEmailRequest {
  /**
   * Customzie who the email is from.
   */
  readonly from?: MailgunRecipient;
  /**
   * Customize who to reply to.
   */
  readonly replyTo?: MailgunRecipient;
  /**
   * Recipients of the email.
   */
  readonly to: ArrayOrValue<MailgunRecipient>;
  /**
   * Email subject
   */
  readonly subject: string;
}

export interface MailgunFileAttachment {
  /**
   * File name
   */
  readonly filename: string;
  /**
   * File data as a buffer or string.
   */
  readonly data: CustomFileData;
}

export interface MailgunTemplateEmailParameters {
  /**
   * Mailgun template name.
   */
  readonly template: MailgunTemplateKey;
  /**
   * Template variables. Each value is converted to a JSON string before being sent to Mailgun server.
   */
  readonly templateVariables?: Record<string, any>;
  /**
   * Whether or not this is considered a test email.
   */
  readonly testEmail?: boolean;
  /**
   * Overrides the global configuration for sending test emails to force sending. Useful when debugging specific tests.
   */
  readonly sendTestEmails?: true | undefined;
}

export interface MailgunTemplateEmailRequest extends MailgunEmailRequest, MailgunTemplateEmailParameters {
  /**
   * Attachment(s) to send with the email.
   */
  readonly attachments?: ArrayOrValue<MailgunFileAttachment>;
  /**
   * Apply custom parameters directly.
   */
  readonly messageData?: Partial<MailgunMessageData>;
}

export type MailgunEmailMessageSendResult = MessagesSendResult;
export type MailgunAPIResponse = APIResponse;

export const DEFAULT_RECIPIENT_VARIABLE_PREFIX = 'recipient-';
export const MAILGUN_REPLY_TO_EMAIL_HEADER_DATA_VARIABLE_KEY = `h:Reply-To`;

export interface ConvertMailgunTemplateEmailRequestToMailgunMessageDataConfig {
  readonly request: MailgunTemplateEmailRequest;
  readonly defaultSender?: string;
  readonly recipientVariablePrefix?: Maybe<string | false>;
  readonly isTestingEnvironment?: boolean;
}

export function convertMailgunTemplateEmailRequestToMailgunMessageData(config: ConvertMailgunTemplateEmailRequestToMailgunMessageDataConfig): MailgunMessageData {
  const { request, defaultSender, isTestingEnvironment: testEnvironment, recipientVariablePrefix = DEFAULT_RECIPIENT_VARIABLE_PREFIX } = config;
  const toInput = asArray(request.to).map((x) => ({ ...x, email: x.email.toLowerCase() }));

  const from = request.from ? convertMailgunRecipientToString(request.from) : defaultSender;
  const to = convertMailgunRecipientsToStrings(toInput);

  const data: MailgunMessageData = {
    from,
    to,
    subject: request.subject,
    template: request.template,
    ...request.messageData
  };

  if (request.replyTo != null) {
    data[MAILGUN_REPLY_TO_EMAIL_HEADER_DATA_VARIABLE_KEY] = convertMailgunRecipientToString(request.replyTo);
  }

  if (request.testEmail === true || ((testEnvironment ?? isTestNodeEnv()) && request.testEmail !== false)) {
    data['o:testmode'] = true;
  }

  if (request.templateVariables) {
    forEachKeyValue(request.templateVariables, {
      forEach: (x) => {
        const [key, value] = x;
        let encodedValue;

        switch (typeof value) {
          case 'object':
            if (value) {
              if (value instanceof Date) {
                encodedValue = value.toISOString();
              } else {
                encodedValue = JSON.stringify(value);
              }
            }
            break;
          case 'bigint':
          case 'boolean':
          case 'number':
          case 'string':
            encodedValue = String(value); // encoded as a string value
            break;
          default:
            if (value) {
              throw new Error(`Invalid value ${value} passed to templateVariables.`);
            }
        }

        if (encodedValue != null) {
          data[`v:${key}`] = encodedValue;
        }
      }
    });
  }

  const hasUserVariables = Boolean(data['recipient-variables']) || toInput.findIndex((x) => x.userVariables != null) !== -1;

  if (hasUserVariables) {
    const recipientVariables: Record<EmailAddress, Record<string, any>> = {};
    const allRecipientVariableKeys: Set<string> = new Set();

    toInput.forEach(({ email, userVariables }) => {
      if (userVariables != null && !objectIsEmpty(userVariables)) {
        recipientVariables[email] = userVariables;
        addToSet(allRecipientVariableKeys, Object.keys(userVariables));
      }
    });

    if (data['recipient-variables']) {
      const decoded = JSON.parse(data['recipient-variables']);

      forEachKeyValue(decoded, {
        forEach: (x) => {
          const [recipientEmail, userVariables] = x;
          const email = (recipientEmail as string).toLowerCase();

          if (recipientVariables[email] != null) {
            overrideInObject(recipientVariables[email], { from: [userVariables], filter: { valueFilter: KeyValueTypleValueFilter.UNDEFINED } });
          } else {
            recipientVariables[email] = userVariables;
          }

          addToSet(allRecipientVariableKeys, Object.keys(userVariables));
        }
      });
    }

    data['recipient-variables'] = JSON.stringify(recipientVariables);

    // add all recipient variable to the other variables so they can be used easily/directly in templates as variables too.
    // https://documentation.mailgun.com/en/latest/user_manual.html#attaching-data-to-messages
    if (recipientVariablePrefix) {
      forEachInIterable(allRecipientVariableKeys, (key) => {
        const recipientVariableKey = `${recipientVariablePrefix}${key}`;

        // v:recipient-id=%recipient.id%
        data[`v:${recipientVariableKey}`] = `%recipient.${key}%`;
      });
    }
  }

  const inputAttachments = request.attachments;

  if (inputAttachments) {
    if (data.attachment) {
      throw new Error(`Cannot specify attachments in both messageData and in the request's attachments field.`);
    }

    data.attachment = inputAttachments as ArrayOrValue<CustomFile>;
  }

  return data;
}

export function convertMailgunRecipientsToStrings(recipients: MailgunRecipient[]): EmailParticipantString[] {
  return recipients.map((x) => convertMailgunRecipientToString(x));
}

export function convertMailgunRecipientToString(recipient: MailgunRecipient): EmailParticipantString {
  let address = recipient.email;

  if (recipient.name) {
    address = `${recipient.name} <${address}>`;
  }

  return address;
}
