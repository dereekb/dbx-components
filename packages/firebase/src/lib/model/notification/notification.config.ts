import { type FirebaseAuthUserId, firestoreBitwiseObjectMap, firestoreNumber, firestoreSubObject, optionalFirestoreBoolean, optionalFirestoreEnum, optionalFirestoreString } from '@dereekb/firebase';
import { type Maybe, type EmailAddress, type E164PhoneNumber, type BitwiseEncodedSet, bitwiseObjectDencoder, type IndexRef, forEachKeyValue } from '@dereekb/util';
import { type NotificationTemplateType } from './notification.id';

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
}

export interface NotificationRecipientWithConfig extends NotificationRecipient, NotificationBoxRecipientTemplateConfig {}

export const firestoreNotificationRecipientWithConfig = firestoreSubObject<NotificationRecipientWithConfig>({
  objectField: {
    fields: {
      uid: optionalFirestoreString(),
      n: optionalFirestoreString(),
      t: optionalFirestoreString(),
      e: optionalFirestoreString(),
      se: optionalFirestoreBoolean(),
      st: optionalFirestoreBoolean(),
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
   * The recipient is not enabled to recieve notifications for now.
   */
  DISABLED = 1,
  /**
   * Recipient opted themselves out from recieving notifications.
   */
  OPT_OUT = 2
}

/**
 * Settings related to recipients that recieve notifications.
 */
export interface NotificationBoxRecipient extends NotificationRecipient, IndexRef {
  /**
   * Enabled config types
   */
  c: NotificationBoxRecipientTemplateConfigMap;
  /**
   * Whether or not this recipient is enabled.
   */
  f?: Maybe<NotificationBoxRecipientFlag>;
}

export function newNotificationBoxRecipientForUid(uid: FirebaseAuthUserId, i: number): NotificationBoxRecipient {
  return {
    c: {},
    i,
    uid
  };
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
  sn?: Maybe<boolean>;
}

export enum NotificationBoxRecipientTemplateConfigBoolean {
  EMAIL = 0,
  TEXT = 1,
  PUSH_NOTIFICATION = 2
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
export type NotificationBoxRecipientTemplateConfigMap = Record<NotificationTemplateType, NotificationBoxRecipientTemplateConfig>;

/**
 * Encoded NotificationBoxRecipientTemplateConfigMap
 */
export type EncodedNotificationBoxRecipientTemplateConfigMap = Record<NotificationTemplateType, EncodedNotificationBoxRecipientTemplateConfig>;

const notificationBoxRecipientTemplateConfigDencoder = bitwiseObjectDencoder<NotificationBoxRecipientTemplateConfig, NotificationBoxRecipientTemplateConfigBoolean>({
  maxIndex: 3,
  toSetFunction: (x) => {
    const set = new Set<NotificationBoxRecipientTemplateConfigBoolean>();

    if (x.st) {
      set.add(NotificationBoxRecipientTemplateConfigBoolean.TEXT);
    }

    if (x.se) {
      set.add(NotificationBoxRecipientTemplateConfigBoolean.EMAIL);
    }

    if (x.sn) {
      set.add(NotificationBoxRecipientTemplateConfigBoolean.PUSH_NOTIFICATION);
    }

    return set;
  },
  fromSetFunction: (x) => {
    const object: NotificationBoxRecipientTemplateConfig = {};

    if (x.has(NotificationBoxRecipientTemplateConfigBoolean.TEXT)) {
      object.st = true;
    }

    if (x.has(NotificationBoxRecipientTemplateConfigBoolean.EMAIL)) {
      object.se = true;
    }

    if (x.has(NotificationBoxRecipientTemplateConfigBoolean.PUSH_NOTIFICATION)) {
      object.sn = true;
    }

    return object;
  }
});

export function firestoreNotificationBoxRecipientTemplateConfigMap() {
  return firestoreBitwiseObjectMap<NotificationBoxRecipientTemplateConfig, NotificationTemplateType>({
    dencoder: notificationBoxRecipientTemplateConfigDencoder
  });
}

export const firestoreNotificationBoxRecipient = firestoreSubObject<NotificationBoxRecipient>({
  objectField: {
    fields: {
      i: firestoreNumber({ default: 0 }),
      uid: optionalFirestoreString(),
      n: optionalFirestoreString(),
      t: optionalFirestoreString(),
      e: optionalFirestoreString(),
      f: optionalFirestoreEnum(),
      c: firestoreNotificationBoxRecipientTemplateConfigMap()
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

export function notificationBoxRecipientTemplateConfigMapToArray(input: NotificationBoxRecipientTemplateConfigMap): NotificationBoxRecipientTemplateConfigArray {
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

export function notificationBoxRecipientTemplateConfigArrayToMap(input: NotificationBoxRecipientTemplateConfigArray): NotificationBoxRecipientTemplateConfigMap {
  const map: NotificationBoxRecipientTemplateConfigMap = {};

  input.forEach((x) => {
    map[x.type] = {
      st: x.st,
      se: x.se,
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
