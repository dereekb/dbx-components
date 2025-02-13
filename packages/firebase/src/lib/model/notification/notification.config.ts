import { type Maybe, type EmailAddress, type E164PhoneNumber, type BitwiseEncodedSet, bitwiseObjectDencoder, type IndexRef, forEachKeyValue, ModelKey, NeedsSyncBoolean, updateMaybeValue, UNSET_INDEX_NUMBER } from '@dereekb/util';
import { NotificationBoxId, NotificationSummaryId, type NotificationTemplateType } from './notification.id';
import { type FirebaseAuthUserId, firestoreBitwiseObjectMap, firestoreNumber, firestoreSubObject, optionalFirestoreBoolean, optionalFirestoreEnum, optionalFirestoreString, firestoreModelKey, firestoreString, SavedToFirestoreIfTrue, FirestoreModelKey, firestoreModelIdString, firestoreModelKeys, firestoreModelKeyString } from '../../common';

// MARK: Recipient
/**
 * Recipient configuration for a notification
 */
export interface NotificationRecipient {
  /**
   * User id for this config, if applicable.
   *
   * Is used to retrieve the contact's information when sending them information, as well as push notification details.
   */
  uid?: Maybe<FirebaseAuthUserId>;
  /**
   * User's name. Overrides any info in the user's Profile.
   */
  n?: Maybe<string>;
  /**
   * User's email address. Overrides any info in the user's Profile.
   */
  e?: Maybe<EmailAddress>;
  /**
   * User's phone number to send text messages to. Overrides any info in the user's Profile.
   */
  t?: Maybe<E164PhoneNumber>;
  /**
   * Notification summary to send notifications to. Ignored and/or set null if uid is defined.
   */
  s?: Maybe<NotificationSummaryId>;
}

export function updateNotificationRecipient(a: NotificationRecipient, b: Partial<NotificationRecipient>): NotificationRecipient {
  const { uid: inputUid, n: inputN, e: inputE, t: inputT, s: inputS } = b;

  const uid = updateMaybeValue(a.uid, inputUid);

  return {
    uid,
    n: updateMaybeValue(a.n, inputN),
    e: updateMaybeValue(a.e, inputE),
    t: updateMaybeValue(a.t, inputT),
    s: uid != null ? null : updateMaybeValue(a.s, inputS) // null if uid is defined
  };
}

export interface NotificationRecipientWithConfig extends NotificationRecipient, NotificationBoxRecipientTemplateConfig {}

export const firestoreNotificationRecipientWithConfig = firestoreSubObject<NotificationRecipientWithConfig>({
  objectField: {
    fields: {
      uid: optionalFirestoreString(),
      n: optionalFirestoreString(),
      e: optionalFirestoreString(),
      t: optionalFirestoreString(),
      s: optionalFirestoreString(),
      se: optionalFirestoreBoolean(),
      st: optionalFirestoreBoolean(),
      sp: optionalFirestoreBoolean(),
      sn: optionalFirestoreBoolean()
    }
  }
});

// MARK: Config
export enum NotificationBoxRecipientFlag {
  /**
   * The recipient is enabled.
   *
   * This is a transient state that should not be stored.
   */
  ENABLED = 0,
  /**
   * The recipient is not enabled to recieve notifications currently.
   */
  DISABLED = 1,
  /**
   * Recipient opted themselves out from recieving notifications.
   */
  OPT_OUT = 2
}

/**
 * Settings related to recipients that recieve notifications.
 *
 * If uid is set, then most other NotificationRecipient fields are ignored as those are pulled from auth.
 */
export interface NotificationBoxRecipient extends NotificationRecipient, IndexRef {
  /**
   * Enabled config types
   */
  c: NotificationBoxRecipientTemplateConfigRecord;
  /**
   * Current opt in flag. Non-zero values are opt-out.
   *
   * TODO: Test updating the flag and syncing
   */
  f?: Maybe<NotificationBoxRecipientFlag>;
  /**
   * Locked state that corresponds to the user's configuration and is sync'd by NotificationUserNotificationBoxRecipientConfig.
   *
   * If locked, updating the NotificationBox recipient will throw an error. The user can update their settings without issue.
   */
  lk?: Maybe<SavedToFirestoreIfTrue>;
}

export function newNotificationBoxRecipientForUid(uid: FirebaseAuthUserId, i: number): NotificationBoxRecipient {
  return {
    c: {},
    i,
    uid
  };
}

/**
 * Default NotificationUserNotificationBoxRecipientConfig.
 */
export interface NotificationUserDefaultNotificationBoxRecipientConfig extends Omit<NotificationBoxRecipient, 'i' | 'n' | 's' | 'uid'> {
  /**
   * Locked state.
   *
   * If locked, updating the NotificationBox recipient will throw an error. The user can update their settings without issue.
   */
  lk?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Blocked state.
   *
   * If blocked, this NotificationBox will not be able to add this user back.
   */
  bk?: Maybe<SavedToFirestoreIfTrue>;
}

/**
 * Used to reflect the NotificationBoxRecipient config back to a NotificationUser.
 *
 * The index reflects the index the user is in the NotificationBox.
 */
export interface NotificationUserNotificationBoxRecipientConfig extends Omit<NotificationBoxRecipient, 'uid'> {
  /**
   * NotificationBox this configuration reflects.
   *
   * The model can be derived from this id.
   */
  nb: NotificationBoxId;
  /**
   * Removed state.
   *
   * If flagged, then this user has been removed from the NotificationBox.
   *
   * The config for this NotificationBox is retained on the NotificationUser, unless the user deletes the configuration themselves.
   */
  rm?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Needs to be sync'd with the NotificationBox
   */
  ns?: Maybe<NeedsSyncBoolean>;
  /**
   * Locked state.
   *
   * If locked, updating the NotificationBox recipient will throw an error. The user can update their settings without issue.
   */
  lk?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Blocked state.
   *
   * If blocked, this NotificationBox will not be able to add this user back.
   */
  bk?: Maybe<SavedToFirestoreIfTrue>;
}

/**
 * Notification configuration state for a template.
 *
 * Denotes which modes of message are enabled for the user to recieve.
 */
export interface NotificationBoxRecipientTemplateConfig {
  /**
   * Email enabled / Send Email
   */
  se?: Maybe<boolean>;
  /**
   * Phone enabled / Send Text
   */
  st?: Maybe<boolean>;
  /**
   * Push notification enabled / Send Push Notification
   */
  sp?: Maybe<boolean>;
  /**
   * Send to notification summary of the associate user, if applicable.
   */
  sn?: Maybe<boolean>;
}

export enum NotificationBoxRecipientTemplateConfigBoolean {
  EMAIL = 0,
  EMAIL_OFF = 1,
  TEXT = 2,
  TEXT_OFF = 3,
  PUSH_NOTIFICATION = 4,
  PUSH_NOTIFICATION_OFF = 5,
  NOTIFICATION_SUMMARY = 6,
  NOTIFICATION_SUMMARY_OFF = 7
}

/**
 * Encoded NotificationBoxRecipientTemplateConfig
 */
export type EncodedNotificationBoxRecipientTemplateConfig = BitwiseEncodedSet;

/**
 * Map of template types to their configurations.
 *
 * Should not be saved with any template type entirely disabled.
 */
export type NotificationBoxRecipientTemplateConfigRecord = Record<NotificationTemplateType, NotificationBoxRecipientTemplateConfig>;

/**
 * Encoded NotificationBoxRecipientTemplateConfigRecord
 */
export type EncodedNotificationBoxRecipientTemplateConfigRecord = Record<NotificationTemplateType, EncodedNotificationBoxRecipientTemplateConfig>;

const notificationBoxRecipientTemplateConfigDencoder = bitwiseObjectDencoder<NotificationBoxRecipientTemplateConfig, NotificationBoxRecipientTemplateConfigBoolean>({
  maxIndex: NotificationBoxRecipientTemplateConfigBoolean.NOTIFICATION_SUMMARY_OFF + 1,
  toSetFunction: (x) => {
    const set = new Set<NotificationBoxRecipientTemplateConfigBoolean>();

    if (x.st != null) {
      set.add(x.st ? NotificationBoxRecipientTemplateConfigBoolean.TEXT : NotificationBoxRecipientTemplateConfigBoolean.TEXT_OFF);
    }

    if (x.se != null) {
      set.add(x.se ? NotificationBoxRecipientTemplateConfigBoolean.EMAIL : NotificationBoxRecipientTemplateConfigBoolean.EMAIL_OFF);
    }

    if (x.sp != null) {
      set.add(x.sp ? NotificationBoxRecipientTemplateConfigBoolean.PUSH_NOTIFICATION : NotificationBoxRecipientTemplateConfigBoolean.PUSH_NOTIFICATION_OFF);
    }

    if (x.sn != null) {
      set.add(x.sn ? NotificationBoxRecipientTemplateConfigBoolean.NOTIFICATION_SUMMARY : NotificationBoxRecipientTemplateConfigBoolean.NOTIFICATION_SUMMARY_OFF);
    }

    return set;
  },
  fromSetFunction: (x) => {
    const object: NotificationBoxRecipientTemplateConfig = {};

    if (x.has(NotificationBoxRecipientTemplateConfigBoolean.TEXT)) {
      object.st = true;
    } else if (x.has(NotificationBoxRecipientTemplateConfigBoolean.TEXT_OFF)) {
      object.st = false;
    }

    if (x.has(NotificationBoxRecipientTemplateConfigBoolean.EMAIL)) {
      object.se = true;
    } else if (x.has(NotificationBoxRecipientTemplateConfigBoolean.EMAIL_OFF)) {
      object.se = false;
    }

    if (x.has(NotificationBoxRecipientTemplateConfigBoolean.PUSH_NOTIFICATION)) {
      object.sp = true;
    } else if (x.has(NotificationBoxRecipientTemplateConfigBoolean.PUSH_NOTIFICATION_OFF)) {
      object.sp = false;
    }

    if (x.has(NotificationBoxRecipientTemplateConfigBoolean.NOTIFICATION_SUMMARY)) {
      object.sn = true;
    } else if (x.has(NotificationBoxRecipientTemplateConfigBoolean.NOTIFICATION_SUMMARY_OFF)) {
      object.sn = false;
    }

    return object;
  }
});

export function firestoreNotificationBoxRecipientTemplateConfigRecord() {
  return firestoreBitwiseObjectMap<NotificationBoxRecipientTemplateConfig, NotificationTemplateType>({
    dencoder: notificationBoxRecipientTemplateConfigDencoder
  });
}

export const firestoreNotificationBoxRecipient = firestoreSubObject<NotificationBoxRecipient>({
  objectField: {
    fields: {
      i: firestoreNumber({ default: UNSET_INDEX_NUMBER }),
      uid: optionalFirestoreString(),
      n: optionalFirestoreString(),
      t: optionalFirestoreString(),
      e: optionalFirestoreString(),
      s: optionalFirestoreString(),
      f: optionalFirestoreEnum({ dontStoreIf: NotificationBoxRecipientFlag.ENABLED }),
      c: firestoreNotificationBoxRecipientTemplateConfigRecord(),
      lk: optionalFirestoreBoolean({ dontStoreValueIf: false })
    }
  }
});

export const firestoreNotificationUserDefaultNotificationBoxRecipientConfig = firestoreSubObject<NotificationUserDefaultNotificationBoxRecipientConfig>({
  objectField: {
    fields: {
      lk: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      bk: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      t: optionalFirestoreString(),
      e: optionalFirestoreString(),
      f: optionalFirestoreEnum({ dontStoreIf: NotificationBoxRecipientFlag.ENABLED }),
      c: firestoreNotificationBoxRecipientTemplateConfigRecord()
    }
  }
});

export const firestoreNotificationUserNotificationBoxRecipientConfig = firestoreSubObject<NotificationUserNotificationBoxRecipientConfig>({
  objectField: {
    fields: {
      nb: firestoreModelIdString,
      rm: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      ns: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      lk: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      bk: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      i: firestoreNumber({ default: UNSET_INDEX_NUMBER }),
      n: optionalFirestoreString(),
      t: optionalFirestoreString(),
      e: optionalFirestoreString(),
      s: optionalFirestoreString(),
      f: optionalFirestoreEnum({ dontStoreIf: NotificationBoxRecipientFlag.ENABLED }),
      c: firestoreNotificationBoxRecipientTemplateConfigRecord()
    }
  }
});

export interface NotificationBoxRecipientTemplateConfigArrayEntry extends NotificationBoxRecipientTemplateConfig {
  /**
   * Array entry template type
   */
  type: NotificationTemplateType;
}

export type NotificationBoxRecipientTemplateConfigArray = NotificationBoxRecipientTemplateConfigArrayEntry[];

export function notificationBoxRecipientTemplateConfigRecordToArray(input: NotificationBoxRecipientTemplateConfigRecord): NotificationBoxRecipientTemplateConfigArray {
  const array: NotificationBoxRecipientTemplateConfigArray = [];

  forEachKeyValue(input, {
    forEach: (x) => {
      array.push({
        type: x[0],
        ...x[1]
      });
    }
  });

  return array;
}

export function notificationBoxRecipientTemplateConfigArrayToRecord(input: NotificationBoxRecipientTemplateConfigArray): NotificationBoxRecipientTemplateConfigRecord {
  const map: NotificationBoxRecipientTemplateConfigRecord = {};

  input.forEach((x) => {
    map[x.type] = {
      st: x.st,
      se: x.se,
      sp: x.sp,
      sn: x.sn
    };
  });

  return map;
}

// MARK: Utility
/**
 * Config object that may contain a boolean called sendNotification.
 */
export interface SendNotificationRef {
  sendNotification?: Maybe<boolean>;
}
