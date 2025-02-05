import { allowedNotificationRecipients, DEFAULT_NOTIFICATION_TEMPLATE_TYPE, type Notification, type NotificationBox, type NotificationBoxRecipient, type NotificationBoxRecipientTemplateConfig, NotificationRecipientSendFlag, type NotificationRecipientWithConfig, type FirebaseAuthDetails, type FirebaseAuthUserId, NotificationSummaryKey, firestoreModelKey, notificationSummaryIdentity, NotificationSummaryId } from '@dereekb/firebase';
import { type FirebaseServerAuthService } from '@dereekb/firebase-server';
import { FactoryWithInput, type E164PhoneNumber, type EmailAddress, type Maybe, type PhoneNumber, FactoryWithRequiredInput } from '@dereekb/util';

export interface ExpandNotificationRecipientsInput {
  readonly notification: Notification;
  readonly notificationBox?: Maybe<NotificationBox>;
  readonly authService: FirebaseServerAuthService;
  /**
   * Factory for creating a NotificationSummaryKey given a uid. If not defined, then notification summaries will not be generated for uids.
   */
  readonly notificationSummaryIdForUid?: FactoryWithRequiredInput<NotificationSummaryId, FirebaseAuthUserId>;
  /**
   * Overrides the recipient flag for the notification.
   */
  readonly recipientFlagOverride?: Maybe<NotificationRecipientSendFlag>;
  /**
   * Recipients that come from the message, also known as global recipients.
   */
  readonly globalRecipients?: Maybe<NotificationRecipientWithConfig[]>;
}

export interface ExpandedNotificationRecipientConfig {
  readonly recipient: NotificationBoxRecipient;
  readonly templateConfig?: Maybe<NotificationBoxRecipientTemplateConfig>;
}

export interface ExpandedNotificationRecipientBase {
  readonly name?: Maybe<string>;
  readonly emailAddress?: Maybe<EmailAddress>;
  readonly phoneNumber?: Maybe<E164PhoneNumber>;
  readonly boxRecipient?: ExpandedNotificationRecipientConfig;
  readonly otherRecipient?: NotificationRecipientWithConfig;
}

export interface ExpandedNotificationRecipientEmail extends ExpandedNotificationRecipientBase {
  readonly emailAddress: EmailAddress;
}

export interface ExpandedNotificationRecipientPhone extends ExpandedNotificationRecipientBase {
  readonly phoneNumber: E164PhoneNumber;
}

export type ExpandedNotificationRecipientText = ExpandedNotificationRecipientPhone;

export interface ExpandedNotificationNotificationSummaryRecipient extends Pick<ExpandedNotificationRecipientBase, 'boxRecipient' | 'otherRecipient'> {
  readonly notificationSummaryKey: NotificationSummaryKey;
}

export interface ExpandNotificationRecipientsResult {
  readonly emails: ExpandedNotificationRecipientEmail[];
  readonly texts: ExpandedNotificationRecipientText[];
  // readonly pushNotifications: ExpandedNotificationRecipient[];
  readonly notificationSummaries: ExpandedNotificationNotificationSummaryRecipient[];
}

export async function expandNotificationRecipients(input: ExpandNotificationRecipientsInput): Promise<ExpandNotificationRecipientsResult> {
  const { authService, notification, notificationBox, globalRecipients: inputGlobalRecipients, recipientFlagOverride, notificationSummaryIdForUid = () => undefined } = input;
  const notificationTemplateType = notification.n.t || DEFAULT_NOTIFICATION_TEMPLATE_TYPE;
  const recipientFlag = recipientFlagOverride ?? notification.rf ?? NotificationRecipientSendFlag.NORMAL;

  const { canSendToGlobalRecipients, canSendToBoxRecipients, canSendToExplicitRecipients } = allowedNotificationRecipients(recipientFlag);

  const explicitRecipients = canSendToExplicitRecipients ? notification.r : [];
  const globalRecipients = canSendToGlobalRecipients && inputGlobalRecipients ? inputGlobalRecipients : [];
  const allBoxRecipientConfigs = canSendToBoxRecipients && notificationBox ? notificationBox.r : [];

  const recipientUids: Set<FirebaseAuthUserId> = new Set<FirebaseAuthUserId>();

  const relevantBoxRecipientConfigs: ExpandedNotificationRecipientConfig[] = [];

  // find all recipients in the NotificationBox with the target template type flagged for them.
  allBoxRecipientConfigs.forEach((x) => {
    // ignore flagged recipients
    if (!x.f) {
      const relevantConfig = x.c[notificationTemplateType];

      if (!relevantConfig || relevantConfig.se || relevantConfig.sp || relevantConfig.st) {
        relevantBoxRecipientConfigs.push({
          recipient: x,
          templateConfig: relevantConfig
        });

        if (x.uid) {
          recipientUids.add(x.uid);
        }
      }
    }
  });

  // add other recipients to the map
  const otherRecipientConfigs = new Map<FirebaseAuthUserId, NotificationRecipientWithConfig>();
  const otherRecipientEmailAddresses = new Map<EmailAddress, NotificationRecipientWithConfig>();
  const otherRecipientTextNumbers = new Map<PhoneNumber, NotificationRecipientWithConfig>();
  const otherRecipientNotificationSummaryKeys = new Map<NotificationSummaryId, NotificationRecipientWithConfig>();

  [...explicitRecipients, ...globalRecipients].forEach((x) => {
    if (x.uid) {
      recipientUids.add(x.uid);
      otherRecipientConfigs.set(x.uid, x);
    }

    if (x.e) {
      otherRecipientEmailAddresses.set(x.e.toLowerCase(), x);
    }

    if (x.t) {
      otherRecipientTextNumbers.set(x.t, x);
    }

    if (x.s) {
      otherRecipientNotificationSummaryKeys.set(firestoreModelKey(notificationSummaryIdentity, x.s), x);
    }
  });

  // load user details from auth service
  const allUserDetails = await Promise.all(
    Array.from(recipientUids).map((uid) =>
      authService
        .userContext(uid)
        .loadDetails()
        .then((details) => [uid, details] as [string, FirebaseAuthDetails | undefined])
        .catch((e) => [uid, undefined] as [string, FirebaseAuthDetails | undefined])
    )
  );
  const userDetailsMap = new Map(allUserDetails);

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
    if (x.templateConfig?.se !== false && !emailUidsSet.has(uid ?? '')) {
      const e = overrideRecipientEmail ?? userDetails?.email; // use override email or the default email

      if (e) {
        const n = overrideRecipientName ?? userDetails?.displayName;
        const email = e.toLowerCase();
        otherRecipientEmailAddresses.delete(email); // don't double-send to the same email

        const emailRecipient: ExpandedNotificationRecipientEmail = {
          emailAddress: email,
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
    const userDetails = userDetailsMap.get(uid);

    if (userDetails) {
      const { email: emailAddress, displayName } = userDetails;

      if (emailAddress && !emailUidsSet.has(uid)) {
        const emailRecipient: ExpandedNotificationRecipientEmail = {
          emailAddress,
          name: x.n ?? displayName,
          otherRecipient: x
        };

        emails.push(emailRecipient);
        emailUidsSet.add(uid);
        otherRecipientEmailAddresses.delete(emailAddress);
      }
    }
  });

  otherRecipientEmailAddresses.forEach((x, e) => {
    const emailRecipient: ExpandedNotificationRecipientEmail = {
      emailAddress: e,
      name: x.n,
      otherRecipient: x
    };

    emails.push(emailRecipient);
  });

  // make all text recipients
  const texts: ExpandedNotificationRecipientText[] = [];
  const textUidsSet = new Set<FirebaseAuthUserId>();

  relevantBoxRecipientConfigs.forEach((x) => {
    const { recipient } = x;
    const { uid } = recipient;

    const userDetails = uid ? userDetailsMap.get(uid) : undefined;
    const otherRecipientForUser = uid ? otherRecipientConfigs.get(uid) : undefined;

    // don't send a text if marked false
    if (x.templateConfig?.st !== false && !textUidsSet.has(uid ?? '')) {
      const t = x.recipient.t ?? userDetails?.phoneNumber; // use override phoneNumber or the default phone

      if (t) {
        const n = x.recipient.n ?? userDetails?.displayName;
        const phoneNumber = t as E164PhoneNumber;
        otherRecipientTextNumbers.delete(phoneNumber); // don't double-send to the same text phone number

        const textRecipient: ExpandedNotificationRecipientText = {
          phoneNumber,
          name: n,
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
    const userDetails = userDetailsMap.get(uid);

    if (userDetails) {
      const { phoneNumber: t, displayName } = userDetails;

      if (t && !textUidsSet.has(uid)) {
        const textRecipient: ExpandedNotificationRecipientText = {
          phoneNumber: t as E164PhoneNumber,
          name: x.n ?? displayName,
          otherRecipient: x
        };

        texts.push(textRecipient);
        textUidsSet.add(uid);
        otherRecipientTextNumbers.delete(t); // don't double-send to the same text phone number
      }
    }
  });

  otherRecipientTextNumbers.forEach((x, t) => {
    const textRecipient: ExpandedNotificationRecipientText = {
      phoneNumber: t as E164PhoneNumber,
      name: x.n,
      otherRecipient: x
    };

    texts.push(textRecipient);
  });

  // make all notification summary recipients
  const notificationSummaries: ExpandedNotificationNotificationSummaryRecipient[] = [];
  const notificationSummaryKeysSet = new Set<NotificationSummaryKey>();
  const notificationSummaryUidsSet = new Set<FirebaseAuthUserId>();

  relevantBoxRecipientConfigs.forEach((x) => {
    const { recipient } = x;
    const { uid } = recipient;

    const otherRecipientForUser = uid ? otherRecipientConfigs.get(uid) : undefined;

    // don't send a notification summary if marked false
    if (x.templateConfig?.sn !== false && !notificationSummaryUidsSet.has(uid ?? '')) {
      let notificationSummaryId: Maybe<NotificationSummaryId>;

      if (uid) {
        // only use the uid (and ignore recipient config) if uid is defined
        notificationSummaryId = notificationSummaryIdForUid(uid);
        notificationSummaryUidsSet.add(uid);
      } else if (x.recipient.s) {
        notificationSummaryId = x.recipient.s;
      }

      let notificationSummaryKey: Maybe<NotificationSummaryKey> = notificationSummaryId ? firestoreModelKey(notificationSummaryIdentity, notificationSummaryId) : undefined;

      if (notificationSummaryKey) {
        notificationSummaries.push({
          notificationSummaryKey,
          boxRecipient: x,
          otherRecipient: otherRecipientForUser
        });
        otherRecipientNotificationSummaryKeys.delete(notificationSummaryKey); // don't double send
      }
    }
  });

  otherRecipientConfigs.forEach((x, uid) => {
    const { s: notificationSummaryId } = x;

    if (notificationSummaryId) {
      const notificationSummaryKey = firestoreModelKey(notificationSummaryIdentity, notificationSummaryId);

      if (!notificationSummaryKeysSet.has(notificationSummaryId)) {
        const notificationSummary: ExpandedNotificationNotificationSummaryRecipient = {
          notificationSummaryKey,
          otherRecipient: x
        };

        notificationSummaries.push(notificationSummary);
        otherRecipientNotificationSummaryKeys.delete(notificationSummaryKey);
      }
    }
  });

  otherRecipientNotificationSummaryKeys.forEach((x, notificationSummaryKey) => {
    const notificationSummary: ExpandedNotificationNotificationSummaryRecipient = {
      notificationSummaryKey,
      otherRecipient: x
    };

    notificationSummaries.push(notificationSummary);
  });

  // results
  const result: ExpandNotificationRecipientsResult = {
    emails,
    texts,
    notificationSummaries
  };

  return result;
}
