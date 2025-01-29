import { allowedNotificationRecipients, DEFAULT_NOTIFICATION_TEMPLATE_TYPE, Notification, NotificationBox, NotificationBoxRecipient, NotificationBoxRecipientTemplateConfig, NotificationRecipientSendFlag, NotificationRecipientWithConfig } from '@dereekb/firebase';
import { FirebaseAuthDetails, FirebaseAuthUserId } from '@dereekb/firebase';
import { FirebaseServerAuthService } from '@dereekb/firebase-server';
import { E164PhoneNumber, EmailAddress, Maybe, PhoneNumber } from '@dereekb/util';

export interface ExpandNotificationRecipientsInput {
  readonly notification: Notification;
  readonly notificationBox?: Maybe<NotificationBox>;
  readonly authService: FirebaseServerAuthService;
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
  name?: Maybe<string>;
  emailAddress?: Maybe<EmailAddress>;
  phoneNumber?: Maybe<E164PhoneNumber>;
  boxRecipient?: ExpandedNotificationRecipientConfig;
  otherRecipient?: NotificationRecipientWithConfig;
}

export interface ExpandedNotificationRecipientEmail extends ExpandedNotificationRecipientBase {
  emailAddress: EmailAddress;
}

export interface ExpandedNotificationRecipientPhone extends ExpandedNotificationRecipientBase {
  phoneNumber: E164PhoneNumber;
}

export type ExpandedNotificationRecipientText = ExpandedNotificationRecipientPhone;

export interface ExpandNotificationRecipientsResult {
  readonly emails: ExpandedNotificationRecipientEmail[];
  readonly texts: ExpandedNotificationRecipientText[];
  // readonly pushNotifications: ExpandedNotificationRecipient[];
}

export async function expandNotificationRecipients(input: ExpandNotificationRecipientsInput): Promise<ExpandNotificationRecipientsResult> {
  const { authService, notification, notificationBox, globalRecipients: inputGlobalRecipients, recipientFlagOverride } = input;
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

      if (!relevantConfig || relevantConfig.se || relevantConfig.sn || relevantConfig.st) {
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
        otherRecipientTextNumbers.delete(phoneNumber); // don't double-send to the same email

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

  // results
  const result: ExpandNotificationRecipientsResult = {
    emails,
    texts
  };

  return result;
}
