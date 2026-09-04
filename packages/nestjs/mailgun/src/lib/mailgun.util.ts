import { type Maybe, type NameEmailPair, asArray, filterMaybeArrayValues, makeValuesGroupMap, type ArrayOrValue, type Configurable } from '@dereekb/util';
import { type MailgunTemplateEmailRequestRecipientVariablesConfig, type MailgunFileAttachment, type MailgunRecipient, type MailgunTemplateEmailRequest } from './mailgun';

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
  /**
   * Attachment(s) to send to only this recipient.
   *
   * Attachments live on the REQUEST rather than the recipient, so a target that carries any is expanded into its own
   * request with batch sending disabled, which is the same treatment cc/bcc receive. That is what lets a per-recipient
   * payload -- an iTIP invite whose ATTENDEE names one address, for instance -- ride the same expansion as the
   * recipients that still batch.
   *
   * Are merged with the base request's attachments when building the request, unless
   * "overrideAttachmentsWithRecipientAttachments" is set.
   */
  readonly attachments?: Maybe<ArrayOrValue<MailgunFileAttachment>>;
}

/**
 * Composite key from the (lowercased) from/replyTo email addresses used to group MailgunRecipientBatchSendTarget values.
 */
export type MailgunRecipientBatchSendTargetFromReplyToBatchGroupKey = string;

/**
 * Creates a composite key from the from/replyTo email addresses used to group MailgunRecipientBatchSendTarget values.
 *
 * @param recipient - Batch send target whose from/replyTo addresses are used as the grouping key.
 * @returns Composite key in the form "f:{fromEmail}|r:{replyToEmail}" used to group recipients into batches.
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
  /**
   * Whether or not to override the base request's attachments with the recipient's attachments.
   *
   * If true, a recipient that carries its own attachments sends ONLY those. By default the two are merged, with the
   * base request's attachments first.
   *
   * Only affects the individual requests that a recipient with attachments is expanded into. A batched request's
   * recipients carry no attachments of their own by definition, so it always sends exactly the base request's.
   *
   * Defaults to false.
   */
  readonly overrideAttachmentsWithRecipientAttachments?: Maybe<boolean>;
  /**
   * Whether or not to throw when an entity key cannot be resolved, either because no lookup is configured or because
   * the key is absent from the configured lookup's map.
   *
   * An unresolved key is invisible downstream: from/replyTo fall back to the base request, and from there to the
   * Mailgun service's default sender, which produces a perfectly VALID message sent from the WRONG address.
   * convertMailgunTemplateEmailRequestToMailgunMessageData() validates only batch sending against cc/bcc, the batch
   * recipient ceiling, and doubly-specified attachments, so it cannot catch this.
   *
   * Defaults to false, in which case the unresolved keys are reported once via console.warn and the fallback behavior
   * is kept.
   */
  readonly throwOnUnresolvedEntityKeys?: Maybe<boolean>;
}

/**
 * Expands each of the input MailgunRecipientBatchSendTarget recipients into individual (or grouped, if no cc/bcc or
 * attachments are present on the input recipient) MailgunTemplateEmailRequest objects, based on the input configuration.
 */
export type ExpandMailgunRecipientBatchSendTargetRequestFactory = (recipients: MailgunRecipientBatchSendTarget[]) => MailgunTemplateEmailRequest[];

/**
 * Creates a ExpandMailgunRecipientBatchSendTargetRequestFactory from the input config.
 *
 * @param config - Factory configuration providing the base request, recipient lookup, and per-recipient variable handling.
 * @returns A factory that expands `MailgunRecipientBatchSendTarget` lists into individual `MailgunTemplateEmailRequest` objects.
 * @throws {Error} When no subject is configured and `useSubjectFromRecipientUserVariables` is false, or when `throwOnUnresolvedEntityKeys` is set and the base request or a recipient carries an entity key that no configured lookup can resolve.
 */
export function expandMailgunRecipientBatchSendTargetRequestFactory(config: ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig): ExpandMailgunRecipientBatchSendTargetRequestFactory {
  const {
    request: inputBaseRequest,
    useSubjectFromRecipientUserVariables,
    allowSingleRecipientBatchSendRequests,
    recipientVariablesConfig,
    mailgunRecipientBatchSendTargetEntityKeyRecipientLookup,
    overrideCarbonCopyVariablesWithCarbonCopyKeyRecipients,
    overrideAttachmentsWithRecipientAttachments,
    throwOnUnresolvedEntityKeys
  } = config;
  const defaultSubject = inputBaseRequest.subject;

  if (!defaultSubject && !useSubjectFromRecipientUserVariables) {
    throw new Error('defaultSubject must be set when "useSubjectFromRecipientUserVariables" is false');
  }

  const recipientsMap = mailgunRecipientBatchSendTargetEntityKeyRecipientLookup?.recipientsMap;

  type MailgunRecipientBatchSendTargetEntityKeyField = 'fromKey' | 'replyToKey' | 'ccKeys' | 'bccKeys';

  interface UnresolvedMailgunRecipientBatchSendTargetEntityKey {
    readonly field: MailgunRecipientBatchSendTargetEntityKeyField;
    readonly key: MailgunRecipientBatchSendTargetEntityKey;
  }

  type EntityKeyCarrier = Pick<MailgunRecipientBatchSendTarget, 'fromKey' | 'replyToKey' | 'ccKeys' | 'bccKeys'>;

  /**
   * Returns every entity key on the input that no configured lookup can resolve.
   *
   * The map is consulted directly because neither getRecipientOrDefaultForKey() nor getRecipientsForKeys() reports a
   * miss; both fall back silently. A partially resolved ccKeys/bccKeys counts too, since a single mistyped key there
   * drops a carbon copy recipient just as quietly.
   *
   * @param carrier - The base request or recipient whose keys are checked.
   * @returns The unresolved keys, paired with the field each was found on.
   */
  function unresolvedEntityKeysFor(carrier: EntityKeyCarrier): UnresolvedMailgunRecipientBatchSendTargetEntityKey[] {
    const unresolved: UnresolvedMailgunRecipientBatchSendTargetEntityKey[] = [];

    function collectUnresolvedKeys(field: MailgunRecipientBatchSendTargetEntityKeyField, keys: Maybe<ArrayOrValue<MailgunRecipientBatchSendTargetEntityKey>>) {
      if (keys != null) {
        asArray(keys).forEach((key) => {
          if (!recipientsMap?.has(key)) {
            unresolved.push({ field, key });
          }
        });
      }
    }

    collectUnresolvedKeys('fromKey', carrier.fromKey);
    collectUnresolvedKeys('replyToKey', carrier.replyToKey);
    collectUnresolvedKeys('ccKeys', carrier.ccKeys);
    collectUnresolvedKeys('bccKeys', carrier.bccKeys);

    return unresolved;
  }

  /**
   * Throws or warns about unresolved entity keys, depending on throwOnUnresolvedEntityKeys.
   *
   * Reports once for the whole set rather than once per key, so a large batch that shares one bad key does not emit a
   * line per recipient.
   *
   * @param source - Description of what carried the keys, used in the message.
   * @param unresolved - The unresolved keys to report. Nothing is reported when empty.
   * @throws {Error} When throwOnUnresolvedEntityKeys is set and at least one unresolved key was given.
   */
  function reportUnresolvedEntityKeys(source: string, unresolved: UnresolvedMailgunRecipientBatchSendTargetEntityKey[]) {
    if (unresolved.length > 0) {
      const describedKeys = Array.from(new Set(unresolved.map(({ field, key }) => `${field}: "${key}"`))).join(', ');
      const reason = recipientsMap ? 'they are absent from the configured mailgunRecipientBatchSendTargetEntityKeyRecipientLookup' : 'no mailgunRecipientBatchSendTargetEntityKeyRecipientLookup was configured';
      const message = `expandMailgunRecipientBatchSendTargetRequestFactory(): ${source} specified entity keys that cannot be resolved [${describedKeys}] because ${reason}. Unresolved keys are ignored in favor of the base request's values, which sends a valid email from the wrong address.`;

      if (throwOnUnresolvedEntityKeys) {
        throw new Error(message);
      } else {
        console.warn(message);
      }
    }
  }

  reportUnresolvedEntityKeys('the base request', unresolvedEntityKeysFor(inputBaseRequest));

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

  /**
   * The attachments every request built by this factory carries, batched or individual.
   *
   * Normalized once here so the merge in determineAttachments() has a single array to work from.
   */
  const baseRequestAttachments: Maybe<MailgunFileAttachment[]> = inputBaseRequest.attachments ? asArray(inputBaseRequest.attachments) : undefined;

  /**
   * Returns the attachments for an individual request, merging the base request's attachments with the recipient's.
   *
   * Will return undefined if the array would be empty.
   *
   * @param recipientAttachments - The recipient's own attachments, if any.
   * @returns The attachments for the request, or undefined when there are none.
   */
  function determineAttachments(recipientAttachments: Maybe<MailgunFileAttachment[]>): Maybe<MailgunFileAttachment[]> {
    let attachments: Maybe<MailgunFileAttachment[]>;

    if (recipientAttachments?.length) {
      attachments = overrideAttachmentsWithRecipientAttachments ? recipientAttachments : [...(baseRequestAttachments ?? []), ...recipientAttachments];
    } else {
      attachments = baseRequestAttachments;
    }

    return attachments?.length ? attachments : undefined;
  }

  const baseRequest: Omit<ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig['request'], 'fromKey' | 'replyToKey' | 'ccKeys' | 'bccKeys'> = {
    ...inputBaseRequest,
    from: baseRequestFrom,
    replyTo: baseRequestReplyTo,
    cc: baseRequestCc,
    bcc: baseRequestBcc,
    attachments: baseRequestAttachments
  };

  delete (baseRequest as Configurable<ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig['request']>).fromKey;
  delete (baseRequest as Configurable<ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig['request']>).replyToKey;
  delete (baseRequest as Configurable<ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig['request']>).ccKeys;
  delete (baseRequest as Configurable<ExpandMailgunRecipientBatchSendTargetRequestFactoryConfig['request']>).bccKeys;

  const configAllowBatchSend = baseRequest.batchSend !== false;

  return (inputRecipients: MailgunRecipientBatchSendTarget[]) => {
    interface ResolvedMailgunRecipientBatchSendTarget extends Omit<MailgunRecipientBatchSendTarget, 'fromKey' | 'replyToKey' | 'ccKeys' | 'bccKeys' | 'cc' | 'bcc' | 'attachments'> {
      readonly cc: Maybe<NameEmailPair[]>;
      readonly bcc: Maybe<NameEmailPair[]>;
      readonly attachments: Maybe<MailgunFileAttachment[]>;
    }

    reportUnresolvedEntityKeys('a recipient', inputRecipients.flatMap(unresolvedEntityKeysFor));

    // Process recipients to resolve keys
    const recipients: ResolvedMailgunRecipientBatchSendTarget[] = inputRecipients.map((recipient) => {
      let from = recipient.from;
      let replyTo = recipient.replyTo;

      if (mailgunRecipientBatchSendTargetEntityKeyRecipientLookup) {
        // try the fromKey, otherwise use the baseRequest.from
        from ??= mailgunRecipientBatchSendTargetEntityKeyRecipientLookup.getRecipientOrDefaultForKey(recipient.fromKey, baseRequest.from);

        // try the replyToKey, otherwise use the baseRequest.replyTo
        replyTo ??= mailgunRecipientBatchSendTargetEntityKeyRecipientLookup.getRecipientOrDefaultForKey(recipient.replyToKey, baseRequest.replyTo);
      } else {
        // use defaults from base request
        from ??= baseRequest.from;
        replyTo ??= baseRequest.replyTo;
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
        bcc,
        attachments: recipient.attachments ? asArray(recipient.attachments) : undefined
      };

      return result;
    });

    const allowBatchSend = configAllowBatchSend && (allowSingleRecipientBatchSendRequests ?? recipients.length > 1);

    const nonBatchSendRequests: MailgunTemplateEmailRequest[] = [];
    const batchSendRequestRecipients: MailgunRecipientBatchSendTarget[] = [];

    recipients.forEach((recipient) => {
      // attachments live on the REQUEST and a MailgunRecipient has no attachment slot, so a recipient carrying its own
      // cannot ride a shared to[] -- every other recipient of that request would receive it too.
      const recipientRequiresOwnRequest = Boolean(recipient.cc?.length || recipient.bcc?.length || recipient.attachments?.length);

      if (allowBatchSend && !recipientRequiresOwnRequest) {
        // add to batch send recipients
        batchSendRequestRecipients.push(recipient);
      } else {
        // add to non-batch send requests

        // use the subject from the recipient's user variables if available as a default
        const cc = recipient.cc;
        const bcc = recipient.bcc;
        const subject = ((useSubjectFromRecipientUserVariables ? recipient.userVariables?.['subject'] : undefined) ?? defaultSubject ?? recipient.userVariables?.['subject']) as string;

        const request = {
          ...baseRequest,
          from: recipient.from ?? baseRequest.from,
          replyTo: recipient.replyTo ?? baseRequest.replyTo,
          recipientVariablesConfig: baseRequest.recipientVariablesConfig ?? recipientVariablesConfig,
          to: recipient,
          cc,
          bcc,
          attachments: determineAttachments(recipient.attachments),
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
          attachments: baseRequestAttachments,
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
 * @param config - The configuration for the lookup.
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
