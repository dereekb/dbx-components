import { type Maybe, type NameEmailPair, asArray, mergeArraysIntoArray, filterMaybeArrayValues, makeValuesGroupMap, ArrayOrValue } from '@dereekb/util';
import { type MailgunTemplateEmailRequestRecipientVariablesConfig, type MailgunRecipient, type MailgunTemplateEmailRequest } from './mailgun';
import { NotificationMessageEntityKey } from '@dereekb/firebase';

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
  /**
   * The from value to use for the request.
   */
  readonly from?: Maybe<NameEmailPair>;
  /**
   * The reply-to value to use for the request.
   */
  readonly replyTo?: Maybe<NameEmailPair>;
  readonly cc?: Maybe<NameEmailPair[]>;
  readonly bcc?: Maybe<NameEmailPair[]>;
}

/**
 * Composite key from the (lowercased) from/replyTo email addresses used to group MailgunRecipientBatchSendTarget values.
 */
export type MailgunRecipientBatchSendTargetFromReplyToBatchGroupKey = string;

/**
 * Creates a composite key from the from/replyTo email addresses used to group MailgunRecipientBatchSendTarget values.
 */
export function mailgunRecipientBatchSendTargetFromReplyToBatchGroupKey(recipient: MailgunRecipientBatchSendTarget): MailgunRecipientBatchSendTargetFromReplyToBatchGroupKey {
  const fromEmail = (recipient.from?.email ?? '').toLowerCase();
  const replyToEmail = (recipient.replyTo?.email ?? '').toLowerCase();
  return `f:${fromEmail}|r:${replyToEmail}`;
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

    let batchSendRequests: MailgunTemplateEmailRequest[] = [];
    const nonBatchSendRequests: MailgunTemplateEmailRequest[] = [];

    const batchSendRequestRecipients: MailgunRecipientBatchSendTarget[] = [];

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
          from: recipient.from ?? baseRequest.from,
          replyTo: recipient.replyTo ?? baseRequest.replyTo,
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

    // create batch send request(s)
    if (batchSendRequestRecipients.length > 0) {
      const subject = useSubjectFromRecipientUserVariables ? MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE : (defaultSubject as string);

      // set the final from/replyTo values on the recipients
      const batchSendRecipientsWithFinalFromAndReplyTo: MailgunRecipientBatchSendTarget[] = batchSendRequestRecipients.map((recipient) => ({
        ...recipient,
        from: recipient.from ?? baseRequest.from,
        replyTo: recipient.replyTo ?? baseRequest.replyTo
      }));

      // Group recipients by their from/replyTo values
      const batchSendRecipientGroups = makeValuesGroupMap(batchSendRecipientsWithFinalFromAndReplyTo, mailgunRecipientBatchSendTargetFromReplyToBatchGroupKey);

      batchSendRecipientGroups.forEach((groupRecipients) => {
        // All recipients in this group should share the same from/replyTo values
        const firstRecipient = groupRecipients[0];
        const batchRequest: MailgunTemplateEmailRequest = {
          ...baseRequest,
          from: firstRecipient.from,
          replyTo: firstRecipient.replyTo,
          recipientVariablesConfig: baseRequest.recipientVariablesConfig ?? recipientVariablesConfig,
          to: groupRecipients,
          subject,
          batchSend: true
        };

        batchSendRequests.push(batchRequest);
      });
    }

    return filterMaybeArrayValues([...batchSendRequests, ...nonBatchSendRequests]);
  };
}

// MARK: NotificationMessageEntityKeyRecipientLookup
/**
 * A lookup for notification message entity keys to recipients.
 */
export interface NotificationMessageEntityKeyRecipientLookup {
  /**
   * The map of recipients for the given keys.
   */
  readonly recipientsMap: Map<NotificationMessageEntityKey, NameEmailPair>;

  /**
   * Returns the recipient for the given key, or the default recipient if the key is not found. If the input is nullish, returns the default recipient if one is defined, otherwise undefined.
   *
   * @param input The key to look up.
   * @param defaultRecipient The default recipient to return if the key is not found.
   * @returns The recipient for the given key, or the default recipient if the key is not found.
   */
  getRecipientOrDefaultForKey(input: Maybe<NotificationMessageEntityKey>, defaultRecipient: NameEmailPair): NameEmailPair;
  getRecipientOrDefaultForKey(input: Maybe<NotificationMessageEntityKey>, defaultRecipient?: Maybe<NameEmailPair>): Maybe<NameEmailPair>;

  /**
   * Returns the recipients for the given keys. If the input is nullish, returns undefined.
   *
   * @param input The keys to look up.
   * @returns The recipients for the given keys.
   */
  getRecipientsForKeys(input: Maybe<ArrayOrValue<NotificationMessageEntityKey>>): Maybe<NameEmailPair[]>;
  getRecipientsForKeys(input: ArrayOrValue<NotificationMessageEntityKey>): NameEmailPair[];
}

/**
 * Configuration for notificationMessageEntityKeyRecipientLookup().
 */
export interface NotificationMessageEntityKeyRecipientLookupConfig {
  readonly recipientsMap: Map<NotificationMessageEntityKey, NameEmailPair>;
}

/**
 * Creates a NotificationMessageEntityKeyRecipientLookup given the input configuration.
 *
 * @param config The configuration for the lookup.
 * @returns The lookup.
 */
export function notificationMessageEntityKeyRecipientLookup(config: NotificationMessageEntityKeyRecipientLookupConfig): NotificationMessageEntityKeyRecipientLookup {
  const { recipientsMap } = config;

  function getRecipientOrDefaultForKey(input: Maybe<NotificationMessageEntityKey>, defaultRecipient: NameEmailPair): NameEmailPair;
  function getRecipientOrDefaultForKey(input: Maybe<NotificationMessageEntityKey>, defaultRecipient?: Maybe<NameEmailPair>): Maybe<NameEmailPair>;
  function getRecipientOrDefaultForKey(input: Maybe<NotificationMessageEntityKey>, defaultRecipient?: Maybe<NameEmailPair>): Maybe<NameEmailPair> {
    let result: Maybe<NameEmailPair> = defaultRecipient;

    if (input) {
      result = recipientsMap.get(input) ?? defaultRecipient;
    }

    return result;
  }

  function getRecipientsForKeys(input: ArrayOrValue<NotificationMessageEntityKey>): NameEmailPair[];
  function getRecipientsForKeys(input: Maybe<ArrayOrValue<NotificationMessageEntityKey>>): Maybe<NameEmailPair[]> {
    let result: Maybe<NameEmailPair[]> = undefined;

    if (input) {
      const keysArray = asArray(input);
      const recipients = filterMaybeArrayValues(keysArray.map((key) => recipientsMap.get(key)));

      if (recipients.length > 0) {
        result = recipients;
      }
    }

    return result;
  }

  return {
    recipientsMap,
    getRecipientOrDefaultForKey,
    getRecipientsForKeys
  };
}
