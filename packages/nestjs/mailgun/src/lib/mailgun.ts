import { isTestNodeEnv } from '@dereekb/nestjs';
import { type ArrayOrValue, asArray, type EmailAddress, type EmailAddressDomain, forEachKeyValue, KeyValueTypleValueFilter, type NameEmailPair, overrideInObject, objectIsEmpty, type EmailParticipantString, addToSet, forEachInIterable, type Maybe, MAP_IDENTITY, filterUndefinedValues } from '@dereekb/util';
import { type APIResponse } from 'mailgun.js/Types/Common/ApiResponse';
import { type CustomFile, type CustomFileData, type MailgunMessageData, type MessagesSendResult } from 'mailgun.js/Types/Messages/Messages';

export type MailgunSenderDomainString = EmailAddressDomain;
export type MailgunTemplateKey = string;

export interface MailgunRecipient extends NameEmailPair {
  readonly userVariables?: Record<string, any>;
}

export interface MailgunEmailRequest {
  /**
   * Mailgun template name.
   */
  readonly template: MailgunTemplateKey;
  /**
   * Template variables. Each value is converted to a JSON string before being sent to Mailgun server.
   */
  readonly templateVariables?: Maybe<Record<string, any>>;
  /**
   * Customzie who the email is from.
   */
  readonly from?: NameEmailPair;
  /**
   * Customize who to reply to.
   */
  readonly replyTo?: NameEmailPair;
  /**
   * Recipients of the email.
   */
  readonly to: ArrayOrValue<MailgunRecipient>;
  /**
   * Email subject
   */
  readonly subject: string;
  /**
   * Whether to allow batch sending. Batch sending occurs when one or more "to" recipients specify their recipient variables.
   *
   * Typically when this value is set to false, there should only be one recipient. This is useful for cases where a BCC needs to be added. Typically when using recipient variables,
   * any BCC'd recipient will actually recieve the email as a "to" address, as recipient variables changes the behavior to use Mailgun's Batch Sending feature.
   *
   * When false, all recipient's configured variables are merged into the global template variables instead.
   *
   * Defaults to true, unless cc or bcc is specified, in which case an error will be thrown if batchSend is not false.
   */
  readonly batchSend?: boolean;
  /**
   * Carbon copy recipients of the email. The "batchSend" value must be false.
   *
   * NOTE: "batchSend" must be false because the behavior of batchSend changes how Mailgun handles the cc recipients in a way that it is equivalent to adding the cc recipients to "to",
   * but without the ability to use recipient variables for those recipients.
   */
  readonly cc?: Maybe<ArrayOrValue<NameEmailPair>>;
  /**
   * Blind carbon copy recipients of the email. The "batchSend" value must be false.
   *
   * NOTE: "batchSend" must be false because the behavior of batchSend changes how Mailgun handles the bcc recipients in a way that it is equivalent to adding the bcc recipients to "to",
   * but without the ability to use recipient variables for those recipients.
   */
  readonly bcc?: Maybe<ArrayOrValue<NameEmailPair>>;
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

export interface MailgunTemplateEmailRequestTestingParameters {
  /**
   * Whether or not this is considered a test email.
   */
  readonly testEmail?: boolean;
  /**
   * Overrides the global configuration for sending test emails to force sending. Useful when debugging specific tests.
   */
  readonly sendTestEmails?: true | undefined;
}

export interface MailgunTemplateEmailRequest extends MailgunEmailRequest, MailgunTemplateEmailRequestTestingParameters {
  /**
   * Attachment(s) to send with the email.
   */
  readonly attachments?: ArrayOrValue<MailgunFileAttachment>;
  /**
   * Apply/override output message data parameters directly.
   */
  readonly messageData?: Partial<MailgunMessageData>;
  /**
   * Finalize the recipient variables before they are re-encoded back to JSON and added to the Mailgun message data.
   */
  readonly finalizeRecipientVariables?: Maybe<MailgunTemplateEmailRequestFinalizeRecipientVariablesFunction>;
}

/**
 * MailgunTemplateEmailRequestFinalizeRecipientVariablesFunction input
 */
export interface MailgunTemplateEmailRequestFinalizeRecipientVariablesFunctionInput {
  /**
   * The current finalize configuration.
   */
  readonly config: ConvertMailgunTemplateEmailRequestToMailgunMessageDataConfig;
  /**
   * The current message data.
   */
  readonly messageData: Readonly<MailgunMessageData>;
}

/**
 * Provides an arbitrary function to modify the recipient variables values before they are re-encoded back to JSON and added to the Mailgun message data.
 *
 * Can directly modify the input object or return a new object to replace the recipient variables
 */
export type MailgunTemplateEmailRequestFinalizeRecipientVariablesFunction = (recipientVariables: Record<EmailAddress, Record<string, any>>, input: MailgunTemplateEmailRequestFinalizeRecipientVariablesFunctionInput) => Maybe<Record<EmailAddress, Record<string, any>>>;

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

/**
 * The maximum number of recipients allowed in a single batch send request.
 */
export const MAX_BATCH_SEND_RECIPIENTS = 1000;

/**
 * Converts a MailgunTemplateEmailRequest to a MailgunMessageData.
 *
 * @param config
 * @returns
 */
export function convertMailgunTemplateEmailRequestToMailgunMessageData(config: ConvertMailgunTemplateEmailRequestToMailgunMessageDataConfig): MailgunMessageData {
  const { request, defaultSender, isTestingEnvironment: testEnvironment, recipientVariablePrefix = DEFAULT_RECIPIENT_VARIABLE_PREFIX } = config;

  const finalizeRecipientVariables = request.finalizeRecipientVariables ?? MAP_IDENTITY;
  const allowBatchSending = request.batchSend ?? true;
  const mergeRecipientVariablesIntoGlobalVariable = !allowBatchSending;

  function mapEmailToLowercase<T extends NameEmailPair>(x: T): T {
    return { ...x, email: x.email.toLowerCase() };
  }

  const toInput = asArray(request.to).map(mapEmailToLowercase);
  const ccInput = request.cc ? asArray(request.cc).map(mapEmailToLowercase) : undefined;
  const bccInput = request.bcc ? asArray(request.bcc).map(mapEmailToLowercase) : undefined;

  const from = request.from ? convertMailgunRecipientToString(request.from) : defaultSender;
  const to = convertMailgunRecipientsToStrings(toInput);
  const cc = ccInput?.length ? convertMailgunRecipientsToStrings(ccInput) : undefined;
  const bcc = bccInput?.length ? convertMailgunRecipientsToStrings(bccInput) : undefined;

  // throw an error if batchSend is not defined and cc or bcc is defined
  if (request.batchSend == null && (ccInput || bccInput)) {
    throw new Error('convertMailgunTemplateEmailRequestToMailgunMessageData(): batchSend must be false when either "cc" or "bcc" is defined.');
  }

  if (allowBatchSending && to.length > MAX_BATCH_SEND_RECIPIENTS) {
    throw new Error(`convertMailgunTemplateEmailRequestToMailgunMessageData(): Can only batch send to a maximum of ${MAX_BATCH_SEND_RECIPIENTS} recipients.`);
  }

  const data: MailgunMessageData = {
    from,
    to,
    cc,
    bcc,
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
        const encodedValue = encodeMailgunTemplateVariableValue(value);

        if (encodedValue != null) {
          data[`v:${key}`] = encodedValue;
        }
      }
    });
  }

  const hasUserVariables = Boolean(data['recipient-variables']) || toInput.findIndex((x) => x.userVariables != null) !== -1;

  if (hasUserVariables) {
    let recipientVariables: Record<EmailAddress, Record<string, any>> = {};
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

    // Finalize the recipient variables before they are re-encoded back to JSON
    recipientVariables =
      finalizeRecipientVariables(recipientVariables, {
        messageData: data,
        config
      }) ?? recipientVariables;

    if (mergeRecipientVariablesIntoGlobalVariable) {
      // iterate all recipient variables and merge them into the global variables
      forEachKeyValue(recipientVariables, {
        forEach: (x) => {
          const [email, userVariables] = x;

          forEachKeyValue(userVariables, {
            forEach: (y) => {
              const [key, value] = y;
              const encodedValue = encodeMailgunTemplateVariableValue(value);

              if (encodedValue != null) {
                data[`v:${key}`] = encodedValue;
              }
            }
          });
        }
      });
    } else {
      // set back on the data object
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
  }

  // double check and remove the recipient variables if we merged them into the global variables
  if (mergeRecipientVariablesIntoGlobalVariable) {
    delete data['recipient-variables'];
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

/**
 * Encodes a value to a string for use as a Mailgun template variable. Throws an error if the value is not supported.
 *
 * @param value The value to encode.
 * @returns The encoded value, or undefined if the value is null or undefined.
 */
export function encodeMailgunTemplateVariableValue(value: any): Maybe<string> {
  let encodedValue: Maybe<string>;

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
        throw new Error(`Invalid value "${value}" passed to encodeMailgunTemplateVariableValue().`);
      }
  }

  return encodedValue;
}
