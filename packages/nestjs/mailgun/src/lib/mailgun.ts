import { isTestNodeEnv } from '@dereekb/nestjs';
import { ArrayOrValue, asArray, EmailAddress, EmailAddressDomain, forEachKeyValue, KeyValueTypleValueFilter, NameEmailPair, overrideInObject, overrideInObjectFunctionFactory, objectHasKey, objectIsEmpty, mergeObjects, EmailParticipantString, addToSet, iterate, forEachInIterable, Maybe } from '@dereekb/util';
import APIResponse from 'mailgun.js/interfaces/ApiResponse';
import { MailgunMessageData, MessagesSendResult } from 'mailgun.js/interfaces/Messages';

export type MailgunSenderDomainString = EmailAddressDomain;
export type MailgunTemplateKey = string;

export interface MailgunRecipient extends NameEmailPair {
  userVariables?: Record<string, any>;
}

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

export const DEFAULT_RECIPIENT_VARIABLE_PREFIX = 'recipient-';

export interface ConvertMailgunTemplateEmailRequestToMailgunMessageDataConfig {
  readonly request: MailgunTemplateEmailRequest;
  readonly defaultSender?: string;
  readonly recipientVariablePrefix?: Maybe<string | false>;
  readonly testEnvironment?: boolean;
}

export function convertMailgunTemplateEmailRequestToMailgunMessageData(config: ConvertMailgunTemplateEmailRequestToMailgunMessageDataConfig): MailgunMessageData {
  const { request, defaultSender, testEnvironment, recipientVariablePrefix = DEFAULT_RECIPIENT_VARIABLE_PREFIX } = config;
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

  if (request.testEmail === true || ((testEnvironment ?? isTestNodeEnv()) && request.testEmail !== false)) {
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
