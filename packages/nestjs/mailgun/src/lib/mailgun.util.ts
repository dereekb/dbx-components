import { type Maybe, type NameEmailPair, asArray, mergeArraysIntoArray, filterMaybeArrayValues } from '@dereekb/util';
import { type MailgunTemplateEmailRequestRecipientVariablesConfig, type MailgunRecipient, type MailgunTemplateEmailRequest } from './mailgun';

/**
 * The default template subject to use when batch sending emails.
 *
 * This pulls the subject from each recipient's user variables.
 */
export const MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE = `%recipient.subject%`;

/**
 * A MailgunRecipient paired with additional cc/bcc values. This type is used by an ExpandMailgunRecipientBatchSendTargetRequestFactory to
 * build properly configured MailgunTemplateEmailRequest values for one or more MailgunRecipientBatchSendTarget.
 */
export interface MailgunRecipientBatchSendTarget extends MailgunRecipient {
  readonly cc?: Maybe<NameEmailPair[]>;
  readonly bcc?: Maybe<NameEmailPair[]>;
}

/**
 * Configuration for expandMailgunRecipientBatchSendTargetRequestFactory().
 */
export interface ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig {
  /**
   * The base request to use.
   *
   * The subject to use as a default.
   */
  readonly request: Omit<MailgunTemplateEmailRequest, 'to' | 'subject'> & Pick<Partial<MailgunTemplateEmailRequest>, 'subject'>;
  /**
   * Whether or not to pull the subject from the recipient's user variables when building the request. If false, expects that a subject is set on the default request.
   *
   * For batch sending, the subject will be set to the MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE value by default.
   *
   * Defaults to true.
   */
  readonly useSubjectFromRecipientUserVariables?: Maybe<boolean>;
  /**
   * Whether or not to allow a single recipient (with no carbon copy data) to be sent as a batch send request.
   *
   * Defaults to false.
   */
  readonly allowSingleRecipientBatchSendRequests?: Maybe<boolean>;
  /**
   * Configuration for the recipient variables.
   */
  readonly recipientVariablesConfig?: MailgunTemplateEmailRequestRecipientVariablesConfig;
}

/**
 * Expands each of the input MailgunRecipientTargetWithCarbonCopyData recipients into individual (or grouped, if no cc/bcc is present on the input recipient) MailgunTemplateEmailRequest objects, based on the input configuration.
 */
export type ExpandMailgunRecipientBatchSendTargetRequestFactory = (recipients: MailgunRecipientBatchSendTarget[]) => MailgunTemplateEmailRequest[];

/**
 * Creates a ExpandMailgunRecipientBatchSendTargetRequestFactory from the input config.
 *
 * @param config
 * @returns
 */
export function expandMailgunRecipientBatchSendTargetRequestFactory(config: ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig): ExpandMailgunRecipientBatchSendTargetRequestFactory {
  const { request: baseRequest, useSubjectFromRecipientUserVariables, allowSingleRecipientBatchSendRequests, recipientVariablesConfig } = config;
  const defaultSubject = baseRequest.subject;

  if (!defaultSubject && !useSubjectFromRecipientUserVariables) {
    throw new Error('defaultSubject must be set when "useSubjectFromRecipientUserVariables" is false');
  }

  const baseRequestCc = baseRequest.cc ? asArray(baseRequest.cc) : undefined;
  const baseRequestBcc = baseRequest.bcc ? asArray(baseRequest.bcc) : undefined;

  const baseRequestHasCarbonCopy = Boolean(baseRequestCc?.length || baseRequestBcc?.length);

  const configAllowBatchSend = baseRequest.batchSend !== false;

  return (recipients: MailgunRecipientBatchSendTarget[]) => {
    const allowBatchSend = configAllowBatchSend && (allowSingleRecipientBatchSendRequests || recipients.length > 1);

    let batchSendRequest: Maybe<MailgunTemplateEmailRequest>;
    const nonBatchSendRequests: MailgunTemplateEmailRequest[] = [];

    const batchSendRequestRecipients: MailgunRecipient[] = [];

    recipients.forEach((recipient) => {
      const recipientHasCarbonCopy = baseRequestHasCarbonCopy || Boolean(recipient.cc?.length || recipient.bcc?.length);

      if (allowBatchSend && !recipientHasCarbonCopy) {
        // add to batch send recipients
        batchSendRequestRecipients.push(recipient);
      } else {
        // add to non-batch send requests

        // use the subject from the recipient's user variables if available as a defaul
        const cc = mergeArraysIntoArray([], baseRequestCc, recipient.cc);
        const bcc = mergeArraysIntoArray([], baseRequestBcc, recipient.bcc);
        const subject = (useSubjectFromRecipientUserVariables ? recipient.userVariables?.['subject'] : undefined) ?? defaultSubject ?? recipient.userVariables?.['subject'];

        const request = {
          ...baseRequest,
          recipientVariablesConfig: baseRequest.recipientVariablesConfig ?? recipientVariablesConfig,
          to: recipient,
          cc,
          bcc,
          subject,
          batchSend: false // explicitly disable batch send for non-batch requests
        };

        nonBatchSendRequests.push(request);
      }
    });

    if (batchSendRequestRecipients.length > 0) {
      const subject = useSubjectFromRecipientUserVariables ? MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE : (defaultSubject as string);

      batchSendRequest = {
        ...baseRequest,
        recipientVariablesConfig: baseRequest.recipientVariablesConfig ?? recipientVariablesConfig,
        to: batchSendRequestRecipients,
        subject,
        batchSend: true
      };
    }

    return filterMaybeArrayValues([batchSendRequest, ...nonBatchSendRequests]);
  };
}
