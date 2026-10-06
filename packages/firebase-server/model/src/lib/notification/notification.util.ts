import {
  allowedNotificationRecipients,
  DEFAULT_NOTIFICATION_TEMPLATE_TYPE,
  type Notification,
  type NotificationBox,
  type NotificationBoxRecipient,
  type NotificationBoxRecipientTemplateConfig,
  NotificationRecipientSendFlag,
  type NotificationRecipientWithConfig,
  type FirebaseAuthDetails,
  type FirebaseAuthUserId,
  type NotificationSummaryId,
  type NotificationBoxId,
  type NotificationUser,
  type NotificationUserNotificationBoxRecipientConfig,
  mergeNotificationBoxRecipients,
  mergeNotificationUserNotificationBoxRecipientConfigs,
  type NotificationUserId,
  type FirestoreDocumentAccessor,
  type NotificationUserDocument,
  loadDocumentsForIds,
  getDocumentSnapshotDataPairsWithData,
  type NotificationUserDefaultNotificationBoxRecipientConfig,
  effectiveNotificationBoxRecipientTemplateConfig,
  mergeNotificationUserDefaultNotificationBoxRecipientConfig,
  type NotificationSummaryIdForUidFunction,
  firestoreDummyKey,
  type NotificationSummary,
  type DocumentDataWithIdAndKey,
  applyExclusionsToNotificationUserNotificationBoxRecipientConfigs,
  isActiveNotificationBoxRecipient,
  NotificationDeliveryMethod,
  type NotificationDeliveryMethodDecisions,
  type NotificationExplicitOptInConfig,
  type NotificationUidRecipientDelivery,
  NotificationUidRecipientSuppression,
  notificationDeliveryMethodDecisionsToTemplateConfig,
  resolveNotificationDeliveryMethodDecisions,
  resolveNotificationUidRecipientDelivery
} from '@dereekb/firebase';
import { type FirebaseServerAuthService } from '@dereekb/firebase-server';
import { type E164PhoneNumber, type EmailAddress, type Maybe, type PhoneNumber, UNSET_INDEX_NUMBER, type ModelKey } from '@dereekb/util';
import { notificationUserBlockedFromBeingAddedToRecipientsError, notificationUserLockedConfigFromBeingUpdatedError } from './notification.error';

// MARK: Create NotificationSummary
/**
 * Creates a blank {@link NotificationSummary} template for a newly initialized model.
 *
 * Sets the creation timestamp to now, associates the summary with the given model key,
 * and initializes with an empty notifications array.
 *
 * @param model - The model key to associate the summary with.
 * @returns A blank {@link NotificationSummary} with creation timestamp and empty notifications.
 *
 * @example
 * ```ts
 * const template = makeNewNotificationSummaryTemplate('projects/abc');
 * // template.m === 'projects/abc', template.n === []
 * ```
 */
export function makeNewNotificationSummaryTemplate(model: ModelKey): NotificationSummary {
  return {
    cat: new Date(),
    m: model,
    o: firestoreDummyKey(),
    s: true,
    n: []
  };
}

// MARK: ExpandNotificationRecipients
/**
 * Input for {@link expandNotificationRecipients}, providing the notification, its associated box,
 * auth service for user lookup, and configuration for recipient filtering.
 */
export interface ExpandNotificationRecipientsInput {
  readonly notification: Notification;
  readonly notificationBox?: Maybe<DocumentDataWithIdAndKey<NotificationBox>>;
  readonly authService: FirebaseServerAuthService;
  /**
   * Used for loading NotificationUsers in the system for accessing default configurations for the "other" recipients not in the NotificationBox.
   */
  readonly notificationUserAccessor: FirestoreDocumentAccessor<NotificationUser, NotificationUserDocument>;
  /**
   * Factory for creating a NotificationSummaryKey given a uid.
   *
   * If not defined, then notification summaries will not be generated for recipients with uids.
   */
  readonly notificationSummaryIdForUid?: Maybe<NotificationSummaryIdForUidFunction>;
  /**
   * Overrides the recipient flag for the notification.
   */
  readonly recipientFlagOverride?: Maybe<NotificationRecipientSendFlag>;
  /**
   * Recipients that come from the message, also known as global recipients.
   */
  readonly globalRecipients?: Maybe<NotificationRecipientWithConfig[]>;
  /**
   * Only send to recipients that have explicitly enabled sending via all given methods, except for text/sms which has its own configuration parameter.
   *
   * Defaults to false.
   */
  readonly onlySendToExplicitlyEnabledRecipients?: Maybe<boolean>;
  /**
   * Only text those who have texting/sms notifications explicitly enabled.
   *
   * Defaults to true.
   */
  readonly onlyTextExplicitlyEnabledRecipients?: Maybe<boolean>;
}

/**
 * A resolved recipient paired with their effective template configuration for a specific notification type.
 */
export interface ExpandedNotificationRecipientConfig {
  readonly recipient: Omit<NotificationBoxRecipient, 'i'>;
  readonly effectiveTemplateConfig?: Maybe<NotificationBoxRecipientTemplateConfig>;
}

/**
 * Base shape for an expanded recipient, containing all resolved contact details
 * and their source (box recipient, other user, or explicit/global recipient).
 */
export interface ExpandedNotificationRecipientBase {
  readonly name?: Maybe<string>;
  readonly emailAddress?: Maybe<EmailAddress>;
  readonly phoneNumber?: Maybe<E164PhoneNumber>;
  /**
   * The recipient that is registered with the NotificationBox and their configuration from that box.
   */
  readonly boxRecipient?: ExpandedNotificationRecipientConfig;
  /**
   * A recipient that is not registered with the NotificationBox but was requested by UID and their configuration from their NotificationUser, if applicable.
   */
  readonly otherUserRecipient?: ExpandedNotificationRecipientConfig;
  /**
   * The recipient that is not registered with the NotificationBox.
   */
  readonly otherRecipient?: NotificationRecipientWithConfig;
}

/**
 * An expanded recipient that has a resolved email address for email channel delivery.
 */
export interface ExpandedNotificationRecipientEmail extends ExpandedNotificationRecipientBase {
  readonly emailAddress: EmailAddress;
}

/**
 * An expanded recipient that has a resolved E.164 phone number for SMS/text channel delivery.
 */
export interface ExpandedNotificationRecipientPhone extends ExpandedNotificationRecipientBase {
  readonly phoneNumber: E164PhoneNumber;
}

/**
 * Alias for text/SMS recipients, identical to phone recipients.
 */
export type ExpandedNotificationRecipientText = ExpandedNotificationRecipientPhone;

/**
 * An expanded recipient that has a resolved {@link NotificationSummaryId} for in-app notification summary delivery.
 */
export interface ExpandedNotificationNotificationSummaryRecipient extends Pick<ExpandedNotificationRecipientBase, 'name' | 'boxRecipient' | 'otherRecipient'> {
  readonly notificationSummaryId: NotificationSummaryId;
}

/**
 * Internal state built during recipient expansion, exposed for debugging and downstream processing.
 * Contains the user detail map, recipient groupings, opt-out sets, and exclusion tracking.
 */
export interface ExpandNotificationRecipientsInternal {
  readonly userDetailsMap: Map<string, FirebaseAuthDetails | undefined>;
  readonly explicitRecipients: NotificationRecipientWithConfig[];
  readonly globalRecipients: NotificationRecipientWithConfig[];
  readonly allBoxRecipientConfigs: NotificationBoxRecipient[];
  readonly relevantBoxRecipientConfigs: ExpandedNotificationRecipientConfig[];
  readonly recipientUids: Set<FirebaseAuthUserId>;
  readonly otherRecipientConfigs: Map<FirebaseAuthUserId, NotificationRecipientWithConfig>;
  readonly explicitOtherRecipientEmailAddresses: Map<EmailAddress, NotificationRecipientWithConfig>;
  readonly explicitOtherRecipientTextNumbers: Map<PhoneNumber, NotificationRecipientWithConfig>;
  readonly explicitOtherRecipientNotificationSummaryIds: Map<NotificationSummaryId, NotificationRecipientWithConfig>;
  readonly otherNotificationUserUidOptOuts: Set<NotificationUserId>;
  readonly otherNotificationUserUidSendExclusions: Set<NotificationUserId>;
  readonly nonNotificationBoxUidRecipientConfigs: Map<FirebaseAuthUserId, NotificationRecipientWithConfig>;
  readonly notificationUserRecipientConfigs: Map<NotificationUserId, NotificationUserDefaultNotificationBoxRecipientConfig>;
  /**
   * The resolved delivery of every uid recipient, including suppressed ones.
   */
  readonly uidRecipientDeliveries: Map<FirebaseAuthUserId, NotificationUidRecipientDelivery>;
}

/**
 * Result of {@link expandNotificationRecipients}, containing channel-specific recipient lists
 * (email, text, notification summary) ready for delivery.
 */
export interface ExpandNotificationRecipientsResult {
  readonly _internal: ExpandNotificationRecipientsInternal;
  readonly emails: ExpandedNotificationRecipientEmail[];
  readonly texts: ExpandedNotificationRecipientText[];
  // readonly pushNotifications: ExpandedNotificationRecipient[];
  readonly notificationSummaries: ExpandedNotificationNotificationSummaryRecipient[];
}

/**
 * "Expands" the input into recipients for emails, texts, etc.
 *
 * Recipients may come from the NotificationBox, Notification or from the global recipients.
 *
 * Recipients are each configurable and may be defined with as little info as a single contact info, or have multiple contact info pieces associated with them.
 *
 * Every uid recipient's NotificationUser is loaded and its settings applied live (see {@link resolveNotificationUidRecipientDelivery}), so changes to the
 * user's global config (`gc`) and box exclusions (`x`) apply without waiting for a box resync. Throws if the NotificationUsers cannot be loaded, so the send
 * is retried instead of sent without the users' settings.
 *
 * @param input - The notification, box, auth service, and recipient configuration.
 * @returns Channel-specific recipient lists (email, text, notification summary) ready for delivery.
 */
export async function expandNotificationRecipients(input: ExpandNotificationRecipientsInput): Promise<ExpandNotificationRecipientsResult> {
  const { notificationUserAccessor, authService, notification, notificationBox, globalRecipients: inputGlobalRecipients, recipientFlagOverride, notificationSummaryIdForUid: inputNotificationSummaryIdForUid, onlySendToExplicitlyEnabledRecipients, onlyTextExplicitlyEnabledRecipients } = input;

  const notificationBoxId = notificationBox?.id;
  const notificationSummaryIdForUid = inputNotificationSummaryIdForUid ?? (() => undefined);
  const notificationTemplateType = notification.n.t || DEFAULT_NOTIFICATION_TEMPLATE_TYPE;
  const recipientFlag = recipientFlagOverride ?? notification.rf ?? NotificationRecipientSendFlag.NORMAL;
  const explicitOptIn: NotificationExplicitOptInConfig = { onlySendToExplicitlyEnabledRecipients, onlyTextExplicitlyEnabledRecipients };

  const { canSendToGlobalRecipients, canSendToBoxRecipients, canSendToExplicitRecipients } = allowedNotificationRecipients(recipientFlag);

  const initialExplicitRecipients = canSendToExplicitRecipients ? notification.r : [];
  const initialGlobalRecipients = canSendToGlobalRecipients && inputGlobalRecipients ? inputGlobalRecipients : [];

  const explicitRecipients: NotificationRecipientWithConfig[] = initialExplicitRecipients.map((x) => ({
    ...x,
    ...effectiveNotificationBoxRecipientTemplateConfig(x)
  }));

  const globalRecipients: NotificationRecipientWithConfig[] = initialGlobalRecipients.map((x) => ({
    ...x,
    ...effectiveNotificationBoxRecipientTemplateConfig(x)
  }));

  const explicitAndGlobalRecipients = [...explicitRecipients, ...globalRecipients];
  const allBoxRecipientConfigs: NotificationBoxRecipient[] = canSendToBoxRecipients && notificationBox ? notificationBox.r : [];

  // active box entries and listed recipients, by uid. The first listing of a uid wins.
  const activeBoxRecipientsByUid = new Map<FirebaseAuthUserId, NotificationBoxRecipient>();
  const listedRecipientsByUid = new Map<FirebaseAuthUserId, NotificationRecipientWithConfig>();
  const nonNotificationBoxUidRecipientConfigs = new Map<FirebaseAuthUserId, NotificationRecipientWithConfig>();

  allBoxRecipientConfigs.forEach((x) => {
    if (x.uid && isActiveNotificationBoxRecipient(x) && !activeBoxRecipientsByUid.has(x.uid)) {
      activeBoxRecipientsByUid.set(x.uid, x);
    }
  });

  explicitAndGlobalRecipients.forEach((x) => {
    const { uid } = x;

    if (uid && !listedRecipientsByUid.has(uid)) {
      listedRecipientsByUid.set(uid, x);

      if (!activeBoxRecipientsByUid.has(uid)) {
        nonNotificationBoxUidRecipientConfigs.set(uid, x);
      }
    }
  });

  // 1. load the NotificationUser of every uid recipient. A failed load throws so the send is retried, rather than sent without the user's settings.
  const allUids = Array.from(new Set([...activeBoxRecipientsByUid.keys(), ...listedRecipientsByUid.keys()]));
  const notificationUsers = new Map<NotificationUserId, NotificationUser>();

  if (allUids.length > 0) {
    const notificationUserDocuments = loadDocumentsForIds(notificationUserAccessor, allUids);
    const notificationUserPairs = await getDocumentSnapshotDataPairsWithData(notificationUserDocuments);

    notificationUserPairs.forEach((x) => {
      notificationUsers.set(x.document.id, x.data); // keyed by the document id, since some NotificationUsers lack a uid value
    });
  }

  // 2. resolve each uid recipient
  const uidRecipientDeliveries = new Map<FirebaseAuthUserId, NotificationUidRecipientDelivery>();
  const notificationUserRecipientConfigs = new Map<NotificationUserId, NotificationUserDefaultNotificationBoxRecipientConfig>();
  const otherNotificationUserUidOptOuts = new Set<NotificationUserId>();
  const otherNotificationUserUidSendExclusions = new Set<NotificationUserId>();
  const recipientUids = new Set<FirebaseAuthUserId>();

  allUids.forEach((uid) => {
    const notificationUser = notificationUsers.get(uid);

    if (notificationUser) {
      notificationUserRecipientConfigs.set(uid, mergeNotificationUserDefaultNotificationBoxRecipientConfig(notificationUser.gc, notificationUser.dc));
    }

    const delivery = resolveNotificationUidRecipientDelivery({
      notificationTemplateType,
      explicitOptIn,
      notificationUser,
      notificationBoxId,
      boxRecipient: activeBoxRecipientsByUid.get(uid),
      listedRecipient: listedRecipientsByUid.get(uid)
    });

    uidRecipientDeliveries.set(uid, delivery);

    switch (delivery.suppression) {
      case NotificationUidRecipientSuppression.OPT_OUT:
        otherNotificationUserUidOptOuts.add(uid);
        break;
      case NotificationUidRecipientSuppression.EXCLUDED:
        otherNotificationUserUidSendExclusions.add(uid);
        break;
      default:
        recipientUids.add(uid);
        break;
    }
  });

  // 3. load the auth details of every recipient that is not suppressed
  const allUserDetails = await Promise.all(
    Array.from(recipientUids).map((uid) =>
      authService
        .userContext(uid)
        .loadDetails()
        .then((details) => [uid, details] as [string, FirebaseAuthDetails | undefined])
        .catch(() => [uid, undefined] as [string, FirebaseAuthDetails | undefined])
    )
  );

  const userDetailsMap = new Map<string, FirebaseAuthDetails | undefined>(allUserDetails);

  // expanded configs for the box recipients and the listed uid recipients that are not suppressed
  const relevantBoxRecipientConfigs: ExpandedNotificationRecipientConfig[] = [];
  const boxRecipientConfigsByUid = new Map<FirebaseAuthUserId, ExpandedNotificationRecipientConfig>();
  const otherRecipientConfigs = new Map<FirebaseAuthUserId, NotificationRecipientWithConfig>();

  // non-uid recipients only. Uid recipients are always delivered to their resolved contact details.
  const explicitOtherRecipientEmailAddresses = new Map<EmailAddress, NotificationRecipientWithConfig>();
  const explicitOtherRecipientTextNumbers = new Map<PhoneNumber, NotificationRecipientWithConfig>();
  const explicitOtherRecipientNotificationSummaryIds = new Map<NotificationSummaryId, NotificationRecipientWithConfig>();

  const nonUidBoxRecipients: { readonly config: ExpandedNotificationRecipientConfig; readonly decisions: NotificationDeliveryMethodDecisions }[] = [];

  allBoxRecipientConfigs.forEach((recipient) => {
    if (isActiveNotificationBoxRecipient(recipient)) {
      const { uid } = recipient;

      if (uid) {
        const delivery = uidRecipientDeliveries.get(uid);

        if (recipientUids.has(uid) && delivery && !boxRecipientConfigsByUid.has(uid)) {
          const config: ExpandedNotificationRecipientConfig = { recipient, effectiveTemplateConfig: notificationDeliveryMethodDecisionsToTemplateConfig(delivery.decisions) };
          relevantBoxRecipientConfigs.push(config);
          boxRecipientConfigsByUid.set(uid, config);
        }
      } else {
        const decisions = resolveNotificationDeliveryMethodDecisions({ configs: [recipient.c[notificationTemplateType]], explicitOptIn });
        const config: ExpandedNotificationRecipientConfig = { recipient, effectiveTemplateConfig: notificationDeliveryMethodDecisionsToTemplateConfig(decisions) };
        relevantBoxRecipientConfigs.push(config);
        nonUidBoxRecipients.push({ config, decisions });
      }
    }
  });

  const nonUidListedRecipients: { readonly recipient: NotificationRecipientWithConfig; readonly decisions: NotificationDeliveryMethodDecisions }[] = [];

  explicitAndGlobalRecipients.forEach((x) => {
    const { uid } = x;

    if (uid) {
      const delivery = uidRecipientDeliveries.get(uid);

      if (recipientUids.has(uid) && delivery && !otherRecipientConfigs.has(uid)) {
        otherRecipientConfigs.set(uid, { ...x, ...notificationDeliveryMethodDecisionsToTemplateConfig(delivery.decisions), uid });
      }
    } else {
      const decisions = resolveNotificationDeliveryMethodDecisions({ configs: [x], explicitOptIn });
      nonUidListedRecipients.push({ recipient: x, decisions });

      if (x.e) {
        explicitOtherRecipientEmailAddresses.set(x.e.toLowerCase(), x);
      }

      if (x.t) {
        explicitOtherRecipientTextNumbers.set(x.t, x);
      }

      if (x.s) {
        explicitOtherRecipientNotificationSummaryIds.set(x.s, x);
      }
    }
  });

  const _internal: ExpandNotificationRecipientsInternal = {
    userDetailsMap,
    explicitRecipients,
    globalRecipients,
    allBoxRecipientConfigs,
    relevantBoxRecipientConfigs,
    recipientUids,
    otherRecipientConfigs,
    explicitOtherRecipientEmailAddresses,
    explicitOtherRecipientTextNumbers,
    explicitOtherRecipientNotificationSummaryIds,
    otherNotificationUserUidOptOuts,
    otherNotificationUserUidSendExclusions,
    nonNotificationBoxUidRecipientConfigs,
    notificationUserRecipientConfigs,
    uidRecipientDeliveries
  };

  // 4. build each channel: uid recipients first, then the non-uid box and listed recipients
  interface ResolvedUidRecipient {
    readonly uid: FirebaseAuthUserId;
    readonly delivery: NotificationUidRecipientDelivery;
    readonly emailAddress: Maybe<EmailAddress>;
    readonly phoneNumber: Maybe<E164PhoneNumber>;
    readonly name: Maybe<string>;
    readonly boxRecipient?: ExpandedNotificationRecipientConfig;
    readonly otherRecipient?: NotificationRecipientWithConfig;
  }

  const resolvedUidRecipients: ResolvedUidRecipient[] = Array.from(recipientUids).map((uid) => {
    const delivery = uidRecipientDeliveries.get(uid) as NotificationUidRecipientDelivery;
    const userDetails = userDetailsMap.get(uid);

    return {
      uid,
      delivery,
      emailAddress: delivery.emailAddress ?? (userDetails?.email as Maybe<EmailAddress>),
      phoneNumber: delivery.phoneNumber ?? (userDetails?.phoneNumber as Maybe<E164PhoneNumber>),
      name: userDetails?.displayName || delivery.name,
      boxRecipient: boxRecipientConfigsByUid.get(uid),
      otherRecipient: otherRecipientConfigs.get(uid)
    };
  });

  // emails
  const emails: ExpandedNotificationRecipientEmail[] = [];
  const emailAddressesSet = new Set<EmailAddress>();

  function addEmail(recipient: Omit<ExpandedNotificationRecipientEmail, 'emailAddress'>, inputEmailAddress: Maybe<EmailAddress>) {
    const emailAddress = inputEmailAddress?.toLowerCase();

    if (emailAddress && !emailAddressesSet.has(emailAddress)) {
      emailAddressesSet.add(emailAddress);
      emails.push({ ...recipient, emailAddress });
    }
  }

  resolvedUidRecipients.forEach((x) => {
    if (x.delivery.decisions[NotificationDeliveryMethod.EMAIL].send) {
      addEmail({ name: x.name, boxRecipient: x.boxRecipient, otherRecipient: x.otherRecipient }, x.emailAddress);
    }
  });

  nonUidBoxRecipients.forEach(({ config, decisions }) => {
    if (decisions[NotificationDeliveryMethod.EMAIL].send) {
      addEmail({ name: config.recipient.n, boxRecipient: config }, config.recipient.e);
    }
  });

  nonUidListedRecipients.forEach(({ recipient, decisions }) => {
    if (decisions[NotificationDeliveryMethod.EMAIL].send) {
      addEmail({ name: recipient.n, otherRecipient: recipient }, recipient.e);
    }
  });

  // texts
  const texts: ExpandedNotificationRecipientText[] = [];
  const phoneNumbersSet = new Set<PhoneNumber>();

  function addText(recipient: Omit<ExpandedNotificationRecipientText, 'phoneNumber'>, phoneNumber: Maybe<PhoneNumber>) {
    if (phoneNumber && !phoneNumbersSet.has(phoneNumber)) {
      phoneNumbersSet.add(phoneNumber);
      texts.push({ ...recipient, phoneNumber: phoneNumber as E164PhoneNumber });
    }
  }

  resolvedUidRecipients.forEach((x) => {
    if (x.delivery.decisions[NotificationDeliveryMethod.TEXT].send) {
      addText({ name: x.name, boxRecipient: x.boxRecipient, otherRecipient: x.otherRecipient }, x.phoneNumber);
    }
  });

  nonUidBoxRecipients.forEach(({ config, decisions }) => {
    if (decisions[NotificationDeliveryMethod.TEXT].send) {
      addText({ name: config.recipient.n, boxRecipient: config }, config.recipient.t);
    }
  });

  nonUidListedRecipients.forEach(({ recipient, decisions }) => {
    if (decisions[NotificationDeliveryMethod.TEXT].send) {
      addText({ name: recipient.n, otherRecipient: recipient }, recipient.t);
    }
  });

  // TODO: Add push notification details...

  // notification summaries
  const notificationSummaries: ExpandedNotificationNotificationSummaryRecipient[] = [];
  const notificationSummaryIdsSet = new Set<NotificationSummaryId>();

  function addNotificationSummary(recipient: Omit<ExpandedNotificationNotificationSummaryRecipient, 'notificationSummaryId'>, notificationSummaryId: Maybe<NotificationSummaryId>) {
    if (notificationSummaryId && !notificationSummaryIdsSet.has(notificationSummaryId)) {
      notificationSummaryIdsSet.add(notificationSummaryId);
      notificationSummaries.push({ ...recipient, notificationSummaryId });
    }
  }

  resolvedUidRecipients.forEach((x) => {
    if (x.delivery.decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send) {
      // only the uid's summary is used, ignoring any summary id configured on the recipient
      addNotificationSummary({ name: x.name, boxRecipient: x.boxRecipient, otherRecipient: x.otherRecipient }, notificationSummaryIdForUid(x.uid));
    }
  });

  nonUidBoxRecipients.forEach(({ config, decisions }) => {
    if (decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send) {
      addNotificationSummary({ name: config.recipient.n, boxRecipient: config }, config.recipient.s);
    }
  });

  nonUidListedRecipients.forEach(({ recipient, decisions }) => {
    if (decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send) {
      addNotificationSummary({ name: recipient.n, otherRecipient: recipient }, recipient.s);
    }
  });

  // results
  const result: ExpandNotificationRecipientsResult = {
    _internal,
    emails,
    texts,
    notificationSummaries
  };

  return result;
}

// MARK: NotificationBox
/**
 * Input for {@link updateNotificationUserNotificationBoxRecipientConfig}.
 *
 * Describes the current state of a recipient's relationship between a {@link NotificationUser}
 * and a specific {@link NotificationBox}, plus the intended change (insert, remove, or update).
 */
export interface UpdateNotificationUserNotificationBoxRecipientConfigInput {
  readonly notificationBoxId: NotificationBoxId;
  readonly notificationBoxAssociatedModelKey: ModelKey;
  readonly notificationUserId: NotificationUserId;
  /**
   * The existing NotificationUser.
   */
  readonly notificationUser: Pick<NotificationUser, 'x' | 'gc' | 'bc'>;
  /**
   * If true, flag as if the recipient is being inserted into the NotificationBox since it does not exist there.
   */
  readonly insertingRecipientIntoNotificationBox?: Maybe<boolean>;
  /**
   * If true, flag as if the recipient is being removed from the NotificationBox.
   */
  readonly removeRecipientFromNotificationBox?: Maybe<boolean>;
  /**
   * The current NotificationBoxRecipient
   */
  readonly notificationBoxRecipient: Maybe<NotificationBoxRecipient>;
}

/**
 * Result of {@link updateNotificationUserNotificationBoxRecipientConfig}.
 */
export interface UpdateNotificationUserNotificationBoxRecipientConfigResult {
  /**
   * New configs array, if changes occured.
   */
  readonly updatedBc?: Maybe<NotificationUserNotificationBoxRecipientConfig[]>;
  /**
   * The updated NotificationBox recipient
   */
  readonly updatedNotificationBoxRecipient: Maybe<NotificationBoxRecipient>;
}

/**
 * Updates a {@link NotificationUser}'s box-specific recipient configuration (`bc` array)
 * based on the current state of their relationship with a {@link NotificationBox}.
 *
 * Handles three scenarios:
 * - **Remove**: marks the user's box config entry with `rm=true` and clears the index.
 * - **Insert**: merges the incoming recipient data with any existing user preferences, respecting
 *   the user's `bk` (blocked-from-add) and `lk` (locked) flags.
 * - **Update**: merges changes from the box recipient, respecting `lk` (locked) and `ns` (needs-sync) flags.
 *
 * Also re-applies send exclusions to the updated config array.
 *
 * @param input - The current state and intended change.
 * @returns The updated box config array and notification box recipient, if changes occurred.
 * @throws {Error} NotificationUserBlockedFromBeingAddedToRecipientsError when inserting a blocked user.
 * @throws {Error} NotificationUserLockedConfigFromBeingUpdatedError when updating a locked user's config.
 */
export function updateNotificationUserNotificationBoxRecipientConfig(input: UpdateNotificationUserNotificationBoxRecipientConfigInput): UpdateNotificationUserNotificationBoxRecipientConfigResult {
  const { notificationBoxId, notificationUserId, notificationUser, insertingRecipientIntoNotificationBox, removeRecipientFromNotificationBox, notificationBoxRecipient } = input;

  const currentNotificationUserBoxIndex = notificationUser.bc.findIndex((x) => x.nb === notificationBoxId);

  const currentNotificationUserBoxIndexExists = currentNotificationUserBoxIndex !== -1;
  const currentNotificationUserBoxGlobalConfig: Partial<NotificationUserDefaultNotificationBoxRecipientConfig> = notificationUser.gc;
  const currentNotificationUserBoxConfig: Partial<NotificationUserNotificationBoxRecipientConfig> = notificationUser.bc[currentNotificationUserBoxIndex] ?? {};

  /**
   * If bc is updated then the user should be updated too
   */
  let updatedBc: Maybe<NotificationUserNotificationBoxRecipientConfig[]>;
  let updatedNotificationBoxRecipient: Maybe<NotificationBoxRecipient>;

  if (removeRecipientFromNotificationBox) {
    // flag as removed in the NotificationUser details if not already flagged as such
    if (currentNotificationUserBoxIndexExists && currentNotificationUserBoxConfig.rm !== true) {
      updatedBc = [...notificationUser.bc];
      updatedBc[currentNotificationUserBoxIndex] = {
        ...(currentNotificationUserBoxConfig as NotificationUserNotificationBoxRecipientConfig),
        nb: notificationBoxId, // set the NotificationBox id
        c: currentNotificationUserBoxConfig.c ?? {},
        i: UNSET_INDEX_NUMBER, // index should be cleared and set to -1
        ns: false, // sync'd
        rm: true
      };
    }
  } else if (notificationBoxRecipient != null) {
    const {
      ns: currentConfigNeedsSync,
      lk: lockedFromChanges,
      bk: blockedFromAdd
    } = {
      ns: currentNotificationUserBoxConfig.ns,
      lk: currentNotificationUserBoxGlobalConfig.lk ?? currentNotificationUserBoxConfig.lk,
      bk: currentNotificationUserBoxGlobalConfig.bk ?? currentNotificationUserBoxConfig.bk
    };

    // if we're re-inserting, then take the prevous config and restore as it was and remove the rm tag
    let updateWithNotificationBoxRecipient: Partial<NotificationBoxRecipient>;

    if (insertingRecipientIntoNotificationBox) {
      // does not exist in the NotificationBox currently
      if (blockedFromAdd) {
        throw notificationUserBlockedFromBeingAddedToRecipientsError(notificationUserId);
      } else if (lockedFromChanges) {
        // ignored the notificationBoxRecipient's updates
        updateWithNotificationBoxRecipient = currentNotificationUserBoxConfig;
      } else {
        updateWithNotificationBoxRecipient = mergeNotificationBoxRecipients(notificationBoxRecipient, currentNotificationUserBoxConfig);
      }
    } else {
      // if locked from changes, throw error
      if (lockedFromChanges) {
        throw notificationUserLockedConfigFromBeingUpdatedError(notificationUserId);
      } else if (currentConfigNeedsSync) {
        // if needs sync, then merge changes from the config into the notificationBoxRecipient
        updateWithNotificationBoxRecipient = mergeNotificationBoxRecipients(notificationBoxRecipient, currentNotificationUserBoxConfig);
      } else {
        // use as-is
        updateWithNotificationBoxRecipient = notificationBoxRecipient;
      }
    }

    const updatedNotificationUserBoxEntry = mergeNotificationUserNotificationBoxRecipientConfigs(
      {
        ...currentNotificationUserBoxConfig,
        i: notificationBoxRecipient.i,
        c: currentNotificationUserBoxConfig.c ?? {},
        nb: notificationBoxId, // set the NotificationBox id
        rm: false // remove/clear the removed flag
      },
      updateWithNotificationBoxRecipient
    );

    updatedBc = [...notificationUser.bc];

    if (currentNotificationUserBoxIndexExists) {
      updatedBc[currentNotificationUserBoxIndex] = updatedNotificationUserBoxEntry;
    } else {
      updatedBc.push(updatedNotificationUserBoxEntry);
    }

    // re-apply exclusions to the updated config(s)
    const withExclusions = applyExclusionsToNotificationUserNotificationBoxRecipientConfigs({
      notificationUser,
      bc: updatedBc,
      recalculateNs: false
    });

    updatedBc = withExclusions.bc;

    // sync index with input NotificationBoxRecipient
    updatedNotificationUserBoxEntry.i = notificationBoxRecipient.i;
    updatedNotificationBoxRecipient = updatedNotificationUserBoxEntry;
  }

  return {
    updatedBc,
    updatedNotificationBoxRecipient
  };
}
