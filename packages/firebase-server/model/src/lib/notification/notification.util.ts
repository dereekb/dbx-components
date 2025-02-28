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
  type NotificationSummaryKey,
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
  mergeNotificationBoxRecipientTemplateConfigs,
  mergeNotificationUserDefaultNotificationBoxRecipientConfig,
  type NotificationSummaryIdForUidFunction,
  firestoreDummyKey,
  type NotificationSummary
} from '@dereekb/firebase';
import { type FirebaseServerAuthService } from '@dereekb/firebase-server';
import { type E164PhoneNumber, type EmailAddress, type Maybe, type PhoneNumber, UNSET_INDEX_NUMBER, type ModelKey } from '@dereekb/util';
import { notificationUserBlockedFromBeingAddedToRecipientsError, notificationUserLockedConfigFromBeingUpdatedError } from './notification.error';

// MARK: Create NotificationSummary
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
export interface ExpandNotificationRecipientsInput {
  readonly notification: Notification;
  readonly notificationBox?: Maybe<NotificationBox>;
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
   * Only text those who have texting/sms notifications explicitly enabled.
   *
   * Defaults to true.
   */
  readonly onlyTextExplicitlyEnabledRecipients?: Maybe<boolean>;
}

export interface ExpandedNotificationRecipientConfig {
  readonly recipient: Omit<NotificationBoxRecipient, 'i'>;
  readonly effectiveTemplateConfig?: Maybe<NotificationBoxRecipientTemplateConfig>;
}

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

export interface ExpandedNotificationRecipientEmail extends ExpandedNotificationRecipientBase {
  readonly emailAddress: EmailAddress;
}

export interface ExpandedNotificationRecipientPhone extends ExpandedNotificationRecipientBase {
  readonly phoneNumber: E164PhoneNumber;
}

export type ExpandedNotificationRecipientText = ExpandedNotificationRecipientPhone;

export interface ExpandedNotificationNotificationSummaryRecipient extends Pick<ExpandedNotificationRecipientBase, 'name' | 'boxRecipient' | 'otherRecipient'> {
  readonly notificationSummaryId: NotificationSummaryId;
}

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
  readonly nonNotificationBoxUidRecipientConfigs: Map<FirebaseAuthUserId, NotificationRecipientWithConfig>;
  readonly notificationUserRecipientConfigs: Map<NotificationUserId, NotificationUserDefaultNotificationBoxRecipientConfig>;
}

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
 * @param input
 * @returns
 */
export async function expandNotificationRecipients(input: ExpandNotificationRecipientsInput): Promise<ExpandNotificationRecipientsResult> {
  const { notificationUserAccessor, authService, notification, notificationBox, globalRecipients: inputGlobalRecipients, recipientFlagOverride, notificationSummaryIdForUid: inputNotificationSummaryIdForUid, onlyTextExplicitlyEnabledRecipients: inputOnlyTextExplicitlyEnabledRecipients } = input;
  const notificationSummaryIdForUid = inputNotificationSummaryIdForUid ?? (() => undefined);
  const notificationTemplateType = notification.n.t || DEFAULT_NOTIFICATION_TEMPLATE_TYPE;
  const recipientFlag = recipientFlagOverride ?? notification.rf ?? NotificationRecipientSendFlag.NORMAL;
  const onlyTextExplicitlyEnabledRecipients = inputOnlyTextExplicitlyEnabledRecipients !== false;

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

  const recipientUids = new Set<FirebaseAuthUserId>();
  const relevantBoxRecipientConfigs: ExpandedNotificationRecipientConfig[] = [];

  // find all recipients in the NotificationBox with the target template type flagged for them.
  allBoxRecipientConfigs.forEach((x) => {
    // ignore opt-out flagged recipients
    if (!x.f) {
      const relevantConfig = x.c[notificationTemplateType];
      const effectiveTemplateConfig = relevantConfig ? effectiveNotificationBoxRecipientTemplateConfig(relevantConfig) : undefined;

      if (!effectiveTemplateConfig || effectiveTemplateConfig.st || effectiveTemplateConfig.se || effectiveTemplateConfig.sp || effectiveTemplateConfig.st) {
        relevantBoxRecipientConfigs.push({
          recipient: x,
          effectiveTemplateConfig
        });

        if (x.uid) {
          recipientUids.add(x.uid);
        }
      }
    }
  });

  // add other recipients to the map
  const nonNotificationBoxUidRecipientConfigs = new Map<FirebaseAuthUserId, NotificationRecipientWithConfig>();

  explicitAndGlobalRecipients.forEach((x) => {
    const { uid } = x;

    if (uid && !recipientUids.has(uid)) {
      // if already in recipientUids then they are a box recipient and we don't have to try and load them.
      nonNotificationBoxUidRecipientConfigs.set(uid, x);
    }
  });

  const otherNotificationUserUidOptOuts = new Set<NotificationUserId>();
  const notificationUserRecipientConfigs = new Map<NotificationUserId, NotificationUserDefaultNotificationBoxRecipientConfig>();

  if (nonNotificationBoxUidRecipientConfigs.size > 0) {
    const nonNotificationBoxRecipientUids = Array.from(nonNotificationBoxUidRecipientConfigs.keys());
    const notificationUserDocuments = loadDocumentsForIds(notificationUserAccessor, nonNotificationBoxRecipientUids);

    // Attempt to load the NotificationUser for each uid.
    // Not guranteed to exist, but those that do we want to their configurations to decide opt-in/opt-out, as well as override the input recipient configuration for the Notification.
    const notificationUsers = await getDocumentSnapshotDataPairsWithData(notificationUserDocuments);

    notificationUsers.forEach((x) => {
      const { data: notificationUser } = x;
      const { dc, gc } = notificationUser;

      const effectiveConfig = mergeNotificationUserDefaultNotificationBoxRecipientConfig(dc, gc);
      const uid = x.document.id;

      notificationUserRecipientConfigs.set(uid, effectiveConfig);

      if (effectiveConfig.f) {
        // if flagged for opt out, add to set
        otherNotificationUserUidOptOuts.add(uid);
      }
    });
  }

  /**
   * Other NotificationRecipientWithConfig
   */
  const otherRecipientConfigs = new Map<FirebaseAuthUserId, NotificationRecipientWithConfig>();

  const explicitOtherRecipientEmailAddresses = new Map<EmailAddress, NotificationRecipientWithConfig>();
  const explicitOtherRecipientTextNumbers = new Map<PhoneNumber, NotificationRecipientWithConfig>();
  const explicitOtherRecipientNotificationSummaryIds = new Map<NotificationSummaryId, NotificationRecipientWithConfig>();

  explicitAndGlobalRecipients.forEach((x) => {
    const uid = x.uid;

    if (uid) {
      if (otherNotificationUserUidOptOuts.has(uid)) {
        return; // do not add to the recipients at all, user has opted out
      }

      const notificationUserRecipientConfig = notificationUserRecipientConfigs.get(uid);

      if (notificationUserRecipientConfig != null) {
        const userTemplateTypeConfig = notificationUserRecipientConfig.c[notificationTemplateType] ?? {};
        const templateConfig: NotificationBoxRecipientTemplateConfig = mergeNotificationBoxRecipientTemplateConfigs(effectiveNotificationBoxRecipientTemplateConfig(userTemplateTypeConfig), x);

        // replace the input NotificationRecipientWithConfig with the user's config
        x = {
          ...notificationUserRecipientConfig,
          ...effectiveNotificationBoxRecipientTemplateConfig(templateConfig),
          uid
        };
      }

      recipientUids.add(uid);
      otherRecipientConfigs.set(uid, x);
    }

    if (x.e) {
      explicitOtherRecipientEmailAddresses.set(x.e.toLowerCase(), x);
    }

    if (x.t) {
      explicitOtherRecipientTextNumbers.set(x.t, x);
    }

    if (x.s) {
      explicitOtherRecipientNotificationSummaryIds.set(x.s, x);
    }
  });

  // load user details from auth service
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
    nonNotificationBoxUidRecipientConfigs,
    notificationUserRecipientConfigs
  };

  // make all email recipients
  const emails: ExpandedNotificationRecipientEmail[] = [];
  const emailUidsSet = new Set<FirebaseAuthUserId>();

  // start with all box recipients
  relevantBoxRecipientConfigs.forEach((x) => {
    const { recipient } = x;
    const { uid, e: overrideRecipientEmail, n: overrideRecipientName } = recipient;

    const userDetails = uid ? userDetailsMap.get(uid) : undefined;
    const otherRecipientForUser = uid ? otherRecipientConfigs.get(uid) : undefined;

    // don't send an email if marked false
    if (x.effectiveTemplateConfig?.se !== false && !emailUidsSet.has(uid ?? '')) {
      const e = overrideRecipientEmail ?? userDetails?.email; // use override email or the default email

      if (e) {
        const n = overrideRecipientName ?? userDetails?.displayName;
        const emailAddress = e.toLowerCase();
        explicitOtherRecipientEmailAddresses.delete(emailAddress); // don't double-send to the same email

        const emailRecipient: ExpandedNotificationRecipientEmail = {
          emailAddress,
          name: n,
          boxRecipient: x,
          otherRecipient: otherRecipientForUser
        };

        emails.push(emailRecipient);

        if (uid) {
          emailUidsSet.add(uid);
        }
      }
    }
  });

  otherRecipientConfigs.forEach((x, uid) => {
    // add users who existing in the system at this step, then other recipients in the next step
    const userDetails = userDetailsMap.get(uid);

    if (userDetails) {
      const { email: userEmailAddress, displayName } = userDetails;
      const sendEmail = x.se !== false;

      if (userEmailAddress && sendEmail && !emailUidsSet.has(uid)) {
        const emailAddress = userEmailAddress.toLowerCase();

        const name = displayName || x.n;
        const emailRecipient: ExpandedNotificationRecipientEmail = {
          emailAddress,
          name,
          otherRecipient: x
        };

        emails.push(emailRecipient);
        emailUidsSet.add(uid);
        explicitOtherRecipientEmailAddresses.delete(emailAddress);
      }
    }
  });

  explicitOtherRecipientEmailAddresses.forEach((x, emailAddress) => {
    const sendEmail = x.se !== false;

    if (sendEmail) {
      const emailRecipient: ExpandedNotificationRecipientEmail = {
        emailAddress: emailAddress,
        name: x.n,
        otherRecipient: x
      };

      emails.push(emailRecipient);
    }
  });

  // make all text recipients
  // text recipients should be explicitly enabled, or marked true
  const texts: ExpandedNotificationRecipientText[] = [];
  const textUidsSet = new Set<FirebaseAuthUserId>();

  relevantBoxRecipientConfigs.forEach((x) => {
    const { recipient } = x;
    const { uid } = recipient;
    const sendTextEnabled = x.effectiveTemplateConfig?.st;

    const userDetails = uid ? userDetailsMap.get(uid) : undefined;
    const otherRecipientForUser = uid ? otherRecipientConfigs.get(uid) : undefined;

    // only send a text if explicitly enabled
    const shouldSendText = (onlyTextExplicitlyEnabledRecipients && sendTextEnabled === true) || (!onlyTextExplicitlyEnabledRecipients && sendTextEnabled !== false);
    if (shouldSendText && !textUidsSet.has(uid ?? '')) {
      const t = x.recipient.t ?? userDetails?.phoneNumber; // use override phoneNumber or the default phone

      if (t) {
        const name = userDetails?.displayName ?? x.recipient.n;
        const phoneNumber = t as E164PhoneNumber;
        explicitOtherRecipientTextNumbers.delete(phoneNumber); // don't double-send to the same text phone number

        const textRecipient: ExpandedNotificationRecipientText = {
          phoneNumber,
          name,
          boxRecipient: x,
          otherRecipient: otherRecipientForUser
        };

        texts.push(textRecipient);

        if (uid) {
          textUidsSet.add(uid);
        }
      }
    }
  });

  otherRecipientConfigs.forEach((x, uid) => {
    // add users who existing in the system at this step, then other recipients in the next step
    const userDetails = userDetailsMap.get(uid);

    if (userDetails) {
      const { phoneNumber, displayName } = userDetails;
      const sendTextEnabled = x.st;

      const sendText = (onlyTextExplicitlyEnabledRecipients && sendTextEnabled === true) || (!onlyTextExplicitlyEnabledRecipients && sendTextEnabled !== false);
      if (phoneNumber != null && sendText && !textUidsSet.has(uid)) {
        const name = displayName || x.n;
        const textRecipient: ExpandedNotificationRecipientText = {
          phoneNumber: phoneNumber as E164PhoneNumber,
          name,
          otherRecipient: x
        };

        texts.push(textRecipient);
        textUidsSet.add(uid);
        explicitOtherRecipientTextNumbers.delete(phoneNumber); // don't double-send to the same text phone number
      }
    }
  });

  explicitOtherRecipientTextNumbers.forEach((x, t) => {
    const sendTextEnabled = x.st;
    const shouldSendText = (onlyTextExplicitlyEnabledRecipients && sendTextEnabled === true) || (!onlyTextExplicitlyEnabledRecipients && sendTextEnabled !== false);

    if (shouldSendText) {
      const textRecipient: ExpandedNotificationRecipientText = {
        phoneNumber: t as E164PhoneNumber,
        name: x.n,
        otherRecipient: x
      };

      texts.push(textRecipient);
    }
  });

  // TODO: Add push notification details...

  // make all notification summary recipients
  const notificationSummaries: ExpandedNotificationNotificationSummaryRecipient[] = [];
  const notificationSummaryKeysSet = new Set<NotificationSummaryKey>();
  const notificationSummaryUidsSet = new Set<FirebaseAuthUserId>();

  relevantBoxRecipientConfigs.forEach((x) => {
    const { recipient } = x;
    const { uid } = recipient;

    const userDetails = uid ? userDetailsMap.get(uid) : undefined;
    const otherRecipientForUser = uid ? otherRecipientConfigs.get(uid) : undefined;
    const sendNotificationSummary = x.effectiveTemplateConfig?.sn !== false;

    // don't send a notification summary if marked false
    if (sendNotificationSummary && !notificationSummaryUidsSet.has(uid ?? '')) {
      let notificationSummaryId: Maybe<NotificationSummaryId>;

      if (uid) {
        // only use the uid (and ignore recipient config) if uid is defined
        notificationSummaryId = notificationSummaryIdForUid(uid);
        notificationSummaryUidsSet.add(uid);
      } else if (x.recipient.s) {
        notificationSummaryId = x.recipient.s;
      }

      if (notificationSummaryId) {
        const name = userDetails?.displayName ?? x.recipient.n;

        notificationSummaries.push({
          notificationSummaryId,
          boxRecipient: x,
          otherRecipient: otherRecipientForUser,
          name
        });

        explicitOtherRecipientNotificationSummaryIds.delete(notificationSummaryId); // don't double send
      }
    }
  });

  otherRecipientConfigs.forEach((x, uid) => {
    // add users who existing in the system at this step, then other recipients in the next step
    const userDetails = userDetailsMap.get(uid);

    if (userDetails) {
      const { phoneNumber, displayName } = userDetails;
      const sendTextEnabled = x.st;

      const sendText = (onlyTextExplicitlyEnabledRecipients && sendTextEnabled === true) || (!onlyTextExplicitlyEnabledRecipients && sendTextEnabled !== false);
      if (phoneNumber != null && sendText && !textUidsSet.has(uid)) {
        const name = displayName || x.n;
        const textRecipient: ExpandedNotificationRecipientText = {
          phoneNumber: phoneNumber as E164PhoneNumber,
          name,
          otherRecipient: x
        };

        texts.push(textRecipient);
        textUidsSet.add(uid);
        explicitOtherRecipientTextNumbers.delete(phoneNumber); // don't double-send to the same text phone number
      }
    }
  });

  otherRecipientConfigs.forEach((x, uid) => {
    const userDetails = userDetailsMap.get(uid);

    if (userDetails) {
      const { displayName } = userDetails;

      const sendNotificationSummary = x.sn;
      if (sendNotificationSummary !== false) {
        let notificationSummaryId: Maybe<NotificationSummaryId>;

        if (uid) {
          notificationSummaryId = notificationSummaryIdForUid(uid);
          notificationSummaryUidsSet.add(uid);
        } else if (x.s) {
          notificationSummaryId = x.s;
        }

        if (notificationSummaryId) {
          if (!notificationSummaryKeysSet.has(notificationSummaryId)) {
            const name = displayName || x.n;
            const notificationSummary: ExpandedNotificationNotificationSummaryRecipient = {
              notificationSummaryId,
              otherRecipient: x,
              name
            };

            notificationSummaries.push(notificationSummary);
            explicitOtherRecipientNotificationSummaryIds.delete(notificationSummaryId);
          }
        }
      }
    }
  });

  explicitOtherRecipientNotificationSummaryIds.forEach((x, notificationSummaryId) => {
    const { sn: sendNotificationSummary } = x;

    if (sendNotificationSummary !== false) {
      const notificationSummary: ExpandedNotificationNotificationSummaryRecipient = {
        notificationSummaryId,
        otherRecipient: x,
        name: x.n
      };

      notificationSummaries.push(notificationSummary);
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
export interface UpdateNotificationUserNotificationBoxRecipientConfigInput {
  readonly notificationBoxId: NotificationBoxId;
  readonly notificationBoxAssociatedModelKey: ModelKey;
  readonly notificationUserId: NotificationUserId;
  /**
   * The existing NotificationUser.
   */
  readonly notificationUser: Pick<NotificationUser, 'gc' | 'bc'>;
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

    // sync index with input NotificationBoxRecipient
    updatedNotificationUserBoxEntry.i = notificationBoxRecipient.i;
    updatedNotificationBoxRecipient = updatedNotificationUserBoxEntry;
  }

  return {
    updatedBc,
    updatedNotificationBoxRecipient
  };
}
