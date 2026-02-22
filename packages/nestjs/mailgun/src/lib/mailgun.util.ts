import { type Maybe, type NameEmailPair, asArray, filterMaybeArrayValues, makeValuesGroupMap, type ArrayOrValue, type Configurable } from '@dereekb/util';
import { type MailgunTemplateEmailRequestRecipientVariablesConfig, type MailgunRecipient, type MailgunTemplateEmailRequest } from './mailgun';

/**
 * The default template subject to use when batch sending emails.
 *
 * This pulls the subject from each recipient's user variables.
 */
export const MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE = `%recipient.subject%`;

/**
 * Arbitrary key used by the sending configuration service for choosing a pre-configured entity.
 *
 * Typically used for customizing the "from" or "replyTo" addresses while maintaining a separation of concerns.
 */
export type MailgunRecipientBatchSendTargetEntityKey = string;

/**
 * A MailgunRecipient paired with additional cc/bcc values. This type is used by an ExpandMailgunRecipientBatchSendTargetRequestFactory to
 * build properly configured MailgunTemplateEmailRequest values for one or more MailgunRecipientBatchSendTarget.
 */
export interface MailgunRecipientBatchSendTarget extends MailgunRecipient {
  /**
   * The from value to use for the request.
   *
   * Takes priority over fromKey.
   */
  readonly from?: Maybe<NameEmailPair>;
  /**
   * Used to look up the from value entity.
   *
   * Is ignored if from is set.
   */
  readonly fromKey?: Maybe<MailgunRecipientBatchSendTargetEntityKey>;
  /**
   * The reply-to value to use for the request.
   *
   * Takes priority over replyToKey.
   */
  readonly replyTo?: Maybe<NameEmailPair>;
  /**
   * Used to look up the reply-to value entity.
   *
   * Is ignored if replyTo is set.
   */
  readonly replyToKey?: Maybe<MailgunRecipientBatchSendTargetEntityKey>;
  /**
   * Carbon copy recipients.
   *
   * Are merged with ccKeys when building the request.
   */
  readonly cc?: Maybe<ArrayOrValue<NameEmailPair>>;
  /**
   * Used to look up the carbon copy recipients.
   *
   * Are merged with cc when building the request.
   */
  readonly ccKeys?: Maybe<ArrayOrValue<MailgunRecipientBatchSendTargetEntityKey>>;
  /**
   * Blind carbon copy recipients.
   *
   * Are merged with bccKeys when building the request.
   */
  readonly bcc?: Maybe<ArrayOrValue<NameEmailPair>>;
  /**
   * Used to look up the blind carbon copy recipients.
   *
   * Are merged with bcc when building the request.
   */
  readonly bccKeys?: Maybe<ArrayOrValue<MailgunRecipientBatchSendTargetEntityKey>>;
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
  readonly request: Omit<MailgunTemplateEmailRequest, 'to' | 'subject'> & Pick<Partial<MailgunTemplateEmailRequest>, 'subject'> & Pick<MailgunRecipientBatchSendTarget, 'fromKey' | 'replyToKey' | 'bccKeys' | 'ccKeys'>;
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
  /**
   * Optional lookup for notification message entity keys.
   */
  readonly mailgunRecipientBatchSendTargetEntityKeyRecipientLookup?: Maybe<MailgunRecipientBatchSendTargetEntityKeyRecipientLookup>;
  /**
   * Whether or not to override the carbon copy variables with the carbon copy key recipients.
   *
   * If true, and carbon copy key recipients are resolved, they will replace the existing carbon copy variables on the recipient.
   * By default, the resolved carbon copy key recipients are merged with the existing carbon copy variables.
   *
   * Defaults to false.
   */
  readonly overrideCarbonCopyVariablesWithCarbonCopyKeyRecipients?: Maybe<boolean>;
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
  const { request: inputBaseRequest, useSubjectFromRecipientUserVariables, allowSingleRecipientBatchSendRequests, recipientVariablesConfig, mailgunRecipientBatchSendTargetEntityKeyRecipientLookup, overrideCarbonCopyVariablesWithCarbonCopyKeyRecipients } = config;
  const defaultSubject = inputBaseRequest.subject;

  if (!defaultSubject && !useSubjectFromRecipientUserVariables) {
    throw new Error('defaultSubject must be set when "useSubjectFromRecipientUserVariables" is false');
  }

  interface DetermineCarbonCopyRecipientsInput {
    readonly baseRequestCarbonCopyRecipients?: Maybe<NameEmailPair[]>;
    readonly carbonCopyRecipients?: Maybe<ArrayOrValue<NameEmailPair>>;
    readonly carbonCopyRecipientsKeys?: Maybe<ArrayOrValue<MailgunRecipientBatchSendTargetEntityKey>>;
  }

  /**
   * Returns the carbon copy recipients, based on the input.
   *
   * Will return undefined if the array would be empty.
   *
   * @param input
   * @returns
   */
  function determineCarbonCopyRecipients(input: DetermineCarbonCopyRecipientsInput): Maybe<NameEmailPair[]> {
    const { baseRequestCarbonCopyRecipients, carbonCopyRecipients, carbonCopyRecipientsKeys } = input;

    let cc: Maybe<NameEmailPair[]> = carbonCopyRecipients ? asArray(carbonCopyRecipients) : baseRequestCarbonCopyRecipients;
    const resolvedCc = mailgunRecipientBatchSendTargetEntityKeyRecipientLookup?.getRecipientsForKeys(carbonCopyRecipientsKeys);

    if (resolvedCc?.length) {
      if (overrideCarbonCopyVariablesWithCarbonCopyKeyRecipients) {
        cc = resolvedCc;
      } else {
        cc = [...(cc ?? []), ...resolvedCc];
      }
    }

    return cc?.length ? cc : undefined;
  }

  const baseRequestCc = determineCarbonCopyRecipients({
    carbonCopyRecipients: inputBaseRequest.cc,
    carbonCopyRecipientsKeys: inputBaseRequest.ccKeys
  });

  const baseRequestBcc = determineCarbonCopyRecipients({
    carbonCopyRecipients: inputBaseRequest.bcc,
    carbonCopyRecipientsKeys: inputBaseRequest.bccKeys
  });

  const baseRequestFrom: Maybe<NameEmailPair> = inputBaseRequest.from ?? mailgunRecipientBatchSendTargetEntityKeyRecipientLookup?.getRecipientOrDefaultForKey(inputBaseRequest.fromKey);
  const baseRequestReplyTo: Maybe<NameEmailPair> = inputBaseRequest.replyTo ?? mailgunRecipientBatchSendTargetEntityKeyRecipientLookup?.getRecipientOrDefaultForKey(inputBaseRequest.replyToKey);

  const baseRequest: Omit<ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig['request'], 'fromKey' | 'replyToKey' | 'ccKeys' | 'bccKeys'> = {
    ...inputBaseRequest,
    from: baseRequestFrom,
    replyTo: baseRequestReplyTo,
    cc: baseRequestCc,
    bcc: baseRequestBcc
  };

  delete (baseRequest as Configurable<ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig['request']>).fromKey;
  delete (baseRequest as Configurable<ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig['request']>).replyToKey;
  delete (baseRequest as Configurable<ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig['request']>).ccKeys;
  delete (baseRequest as Configurable<ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig['request']>).bccKeys;

  const configAllowBatchSend = baseRequest.batchSend !== false;

  return (inputRecipients: MailgunRecipientBatchSendTarget[]) => {
    interface ResolvedMailgunRecipientBatchSendTarget extends Omit<MailgunRecipientBatchSendTarget, 'fromKey' | 'replyToKey' | 'ccKeys' | 'bccKeys' | 'cc' | 'bcc'> {
      readonly cc: Maybe<NameEmailPair[]>;
      readonly bcc: Maybe<NameEmailPair[]>;
    }

    // Process recipients to resolve keys
    const recipients: ResolvedMailgunRecipientBatchSendTarget[] = inputRecipients.map((recipient) => {
      let from = recipient.from;
      let replyTo = recipient.replyTo;

      if (mailgunRecipientBatchSendTargetEntityKeyRecipientLookup) {
        // try the fromKey, otherwise use the baseRequest.from
        if (!from) {
          from = mailgunRecipientBatchSendTargetEntityKeyRecipientLookup.getRecipientOrDefaultForKey(recipient.fromKey, baseRequest.from);
        }

        // try the replyToKey, otherwise use the baseRequest.replyTo
        if (!replyTo) {
          replyTo = mailgunRecipientBatchSendTargetEntityKeyRecipientLookup.getRecipientOrDefaultForKey(recipient.replyToKey, baseRequest.replyTo);
        }
      } else {
        // use defaults from base request
        if (!from) {
          from = baseRequest.from;
        }

        if (!replyTo) {
          replyTo = baseRequest.replyTo;
        }
      }

      const cc = determineCarbonCopyRecipients({
        baseRequestCarbonCopyRecipients: baseRequestCc,
        carbonCopyRecipients: recipient.cc,
        carbonCopyRecipientsKeys: recipient.ccKeys
      });

      const bcc = determineCarbonCopyRecipients({
        baseRequestCarbonCopyRecipients: baseRequestBcc,
        carbonCopyRecipients: recipient.bcc,
        carbonCopyRecipientsKeys: recipient.bccKeys
      });

      const result: ResolvedMailgunRecipientBatchSendTarget = {
        ...recipient,
        from,
        replyTo,
        cc,
        bcc
      };

      return result;
    });

    const allowBatchSend = configAllowBatchSend && (allowSingleRecipientBatchSendRequests || recipients.length > 1);

    const nonBatchSendRequests: MailgunTemplateEmailRequest[] = [];
    const batchSendRequestRecipients: MailgunRecipientBatchSendTarget[] = [];

    recipients.forEach((recipient) => {
      const recipientHasCarbonCopy = Boolean(recipient.cc?.length || recipient.bcc?.length);

      if (allowBatchSend && !recipientHasCarbonCopy) {
        // add to batch send recipients
        batchSendRequestRecipients.push(recipient);
      } else {
        // add to non-batch send requests

        // use the subject from the recipient's user variables if available as a default
        const cc = recipient.cc;
        const bcc = recipient.bcc;
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
    const batchSendRequests: MailgunTemplateEmailRequest[] = [];

    if (batchSendRequestRecipients.length > 0) {
      const subject = useSubjectFromRecipientUserVariables ? MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE : (defaultSubject as string);

      // Group recipients by their from/replyTo values
      const batchSendRecipientGroups = makeValuesGroupMap(batchSendRequestRecipients, mailgunRecipientBatchSendTargetFromReplyToBatchGroupKey);

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

// MARK: MailgunRecipientBatchSendTargetEntityKeyRecipientLookup
/**
 * A lookup for notification message entity keys to recipients.
 */
export interface MailgunRecipientBatchSendTargetEntityKeyRecipientLookup {
  /**
   * The map of recipients for the given keys.
   */
  readonly recipientsMap: Map<MailgunRecipientBatchSendTargetEntityKey, NameEmailPair>;

  /**
   * Returns the recipient for the given key, or the default recipient if the key is not found. If the input is nullish, returns the default recipient if one is defined, otherwise undefined.
   *
   * @param input The key to look up.
   * @param defaultRecipient The default recipient to return if the key is not found.
   * @returns The recipient for the given key, or the default recipient if the key is not found.
   */
  getRecipientOrDefaultForKey(input: Maybe<MailgunRecipientBatchSendTargetEntityKey>, defaultRecipient: NameEmailPair): NameEmailPair;
  getRecipientOrDefaultForKey(input: Maybe<MailgunRecipientBatchSendTargetEntityKey>, defaultRecipient?: Maybe<NameEmailPair>): Maybe<NameEmailPair>;

  /**
   * Returns the recipients for the given keys. If the input is nullish, returns undefined.
   *
   * @param input The keys to look up.
   * @returns The recipients for the given keys.
   */
  getRecipientsForKeys(input: Maybe<ArrayOrValue<MailgunRecipientBatchSendTargetEntityKey>>): Maybe<NameEmailPair[]>;
  getRecipientsForKeys(input: ArrayOrValue<MailgunRecipientBatchSendTargetEntityKey>): NameEmailPair[];
}

/**
 * Configuration for mailgunRecipientBatchSendTargetEntityKeyRecipientLookup().
 */
export interface MailgunRecipientBatchSendTargetEntityKeyRecipientLookupConfig {
  readonly recipientsMap: Map<MailgunRecipientBatchSendTargetEntityKey, NameEmailPair>;
}

/**
 * Creates a MailgunRecipientBatchSendTargetEntityKeyRecipientLookup given the input configuration.
 *
 * @param config The configuration for the lookup.
 * @returns The lookup.
 */
export function mailgunRecipientBatchSendTargetEntityKeyRecipientLookup(config: MailgunRecipientBatchSendTargetEntityKeyRecipientLookupConfig): MailgunRecipientBatchSendTargetEntityKeyRecipientLookup {
  const { recipientsMap } = config;

  function getRecipientOrDefaultForKey(input: Maybe<MailgunRecipientBatchSendTargetEntityKey>, defaultRecipient: NameEmailPair): NameEmailPair;
  function getRecipientOrDefaultForKey(input: Maybe<MailgunRecipientBatchSendTargetEntityKey>, defaultRecipient?: Maybe<NameEmailPair>): Maybe<NameEmailPair>;
  function getRecipientOrDefaultForKey(input: Maybe<MailgunRecipientBatchSendTargetEntityKey>, defaultRecipient?: Maybe<NameEmailPair>): Maybe<NameEmailPair> {
    let result: Maybe<NameEmailPair> = defaultRecipient;

    if (input) {
      result = recipientsMap.get(input) ?? defaultRecipient;
    }

    return result;
  }

  function getRecipientsForKeys(input: ArrayOrValue<MailgunRecipientBatchSendTargetEntityKey>): NameEmailPair[];
  function getRecipientsForKeys(input: Maybe<ArrayOrValue<MailgunRecipientBatchSendTargetEntityKey>>): Maybe<NameEmailPair[]> {
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
