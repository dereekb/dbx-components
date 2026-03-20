/**
 * @module notification.config
 *
 * Notification recipient configuration types and the bitwise encoding system for per-template channel preferences.
 *
 * Configuration follows a 3-level hierarchy (highest priority first):
 * 1. {@link NotificationUser.gc} — Global config override (applies at send time, not synced to boxes)
 * 2. {@link NotificationUserNotificationBoxRecipientConfig} — Per-box config on the user (synced to boxes)
 * 3. {@link NotificationBoxRecipientTemplateConfig} — Template defaults from the system configuration
 *
 * Each level can enable/disable delivery per channel (email, text, push, summary) per template type.
 * Configs are stored efficiently using bitwise encoding via {@link EncodedNotificationBoxRecipientTemplateConfig}.
 */
import { type Maybe, type EmailAddress, type E164PhoneNumber, type BitwiseEncodedSet, bitwiseObjectDencoder, type IndexRef, forEachKeyValue, type NeedsSyncBoolean, updateMaybeValue, UNSET_INDEX_NUMBER, mergeObjectsFunction, KeyValueTypleValueFilter, mergeObjects } from '@dereekb/util';
import { type NotificationBoxId, type NotificationSummaryId, type NotificationTemplateType } from './notification.id';
import { type FirebaseAuthUserId, firestoreBitwiseObjectMap, firestoreNumber, firestoreSubObject, optionalFirestoreBoolean, optionalFirestoreEnum, optionalFirestoreString, type SavedToFirestoreIfTrue, firestoreModelIdString } from '../../common';

/**
 * Per-template notification channel preferences for a recipient.
 *
 * Controls which delivery channels are enabled for a specific {@link NotificationTemplateType}.
 * Undefined values inherit from the parent level in the configuration hierarchy.
 *
 * Field abbreviations:
 * - `sd` — send default (master toggle for all channels)
 * - `se` — send email
 * - `st` — send text/SMS
 * - `sp` — send push notification
 * - `sn` — send to notification summary
 */
export interface NotificationBoxRecipientTemplateConfig {
  /**
   * Master toggle. When set, acts as the default for all channels that aren't individually configured.
   */
  sd?: Maybe<boolean>;
  /**
   * Email channel enabled/disabled.
   */
  se?: Maybe<boolean>;
  /**
   * Text/SMS channel enabled/disabled.
   */
  st?: Maybe<boolean>;
  /**
   * Push notification channel enabled/disabled.
   */
  sp?: Maybe<boolean>;
  /**
   * In-app notification summary channel enabled/disabled.
   */
  sn?: Maybe<boolean>;
}

/**
 * Merges two {@link NotificationBoxRecipientTemplateConfig} objects, preferring values from `a` over `b`.
 *
 * @param a - primary config whose defined values take precedence
 * @param b - fallback config supplying values when `a` fields are undefined
 * @returns the merged template config with values from `a` preferred over `b`
 *
 * @example
 * ```ts
 * const merged = mergeNotificationBoxRecipientTemplateConfigs(
 *   { se: true },       // user prefers email on
 *   { se: false, st: true } // defaults
 * );
 * // merged === { se: true, st: true }
 * ```
 */
export function mergeNotificationBoxRecipientTemplateConfigs(a?: Maybe<NotificationBoxRecipientTemplateConfig>, b?: Maybe<NotificationBoxRecipientTemplateConfig>): NotificationBoxRecipientTemplateConfig {
  const { sd, se, st, sp, sn } = a ?? {};
  const { sd: sdb, se: seb, st: stb, sp: spb, sn: snb } = b ?? {};

  return {
    sd: sd ?? sdb,
    se: se ?? seb,
    st: st ?? stb,
    sp: sp ?? spb,
    sn: sn ?? snb
  };
}

/**
 * Resolves a {@link NotificationBoxRecipientTemplateConfig} by filling in undefined channel flags with the `sd` (send default) value.
 *
 * This produces the "effective" configuration used at send time, where each channel has a definite boolean.
 *
 * @param a - the template config to resolve
 * @returns the effective config with each channel flag filled in using the send-default fallback
 *
 * @example
 * ```ts
 * const effective = effectiveNotificationBoxRecipientTemplateConfig({ sd: true, se: false });
 * // effective === { sd: true, se: false, st: true, sp: true, sn: true }
 * ```
 */
export function effectiveNotificationBoxRecipientTemplateConfig(a: NotificationBoxRecipientTemplateConfig): NotificationBoxRecipientTemplateConfig {
  const { sd, se, st, sp, sn } = a;

  return {
    sd,
    se: se ?? sd,
    st: st ?? sd,
    sp: sp ?? sd,
    sn: sn ?? sd
  };
}

// MARK: Recipient
/**
 * Contact information for a notification recipient.
 *
 * When `uid` is set, the server resolves contact details (name, email, phone) from the user's profile.
 * Override fields (`n`, `e`, `t`) take precedence over profile data when present.
 *
 * Field abbreviations:
 * - `uid` — Firebase auth user ID
 * - `n` — name override
 * - `e` — email override
 * - `t` — phone/text number override (E.164 format)
 * - `s` — notification summary ID (ignored when `uid` is set)
 */
export interface NotificationRecipient {
  /**
   * Firebase auth UID. When set, contact info is resolved from the user's profile and push notification tokens.
   */
  uid?: Maybe<FirebaseAuthUserId>;
  /**
   * Display name override. Takes precedence over the user's profile name.
   */
  n?: Maybe<string>;
  /**
   * Email address override. Takes precedence over the user's profile email.
   */
  e?: Maybe<EmailAddress>;
  /**
   * Phone number override (E.164 format). Takes precedence over the user's profile phone.
   */
  t?: Maybe<E164PhoneNumber>;
  /**
   * Notification summary ID for in-app delivery. Automatically cleared when `uid` is set.
   */
  s?: Maybe<NotificationSummaryId>;
}

/**
 * Updates a {@link NotificationRecipient} with partial values, preserving existing fields where the update is undefined.
 *
 * Automatically clears the summary ID (`s`) when a `uid` is present.
 *
 * @param a - existing recipient to update
 * @param b - partial values to apply on top of the existing recipient
 * @returns the updated recipient with merged values
 */
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

/**
 * A {@link NotificationRecipient} combined with inline {@link NotificationBoxRecipientTemplateConfig} overrides.
 *
 * Used on individual {@link Notification} documents to attach per-notification recipient preferences
 * that can override the box-level and user-level configurations.
 */
export interface NotificationRecipientWithConfig extends NotificationRecipient, NotificationBoxRecipientTemplateConfig {}

/**
 * Firestore sub-object converter for {@link NotificationRecipientWithConfig}.
 */
export const firestoreNotificationRecipientWithConfig = firestoreSubObject<NotificationRecipientWithConfig>({
  objectField: {
    fields: {
      uid: optionalFirestoreString(),
      n: optionalFirestoreString(),
      e: optionalFirestoreString(),
      t: optionalFirestoreString(),
      s: optionalFirestoreString(),
      sd: optionalFirestoreBoolean(),
      se: optionalFirestoreBoolean(),
      st: optionalFirestoreBoolean(),
      sp: optionalFirestoreBoolean(),
      sn: optionalFirestoreBoolean()
    }
  }
});

// MARK: Config
/**
 * Recipient-level opt-in/opt-out flag on a {@link NotificationBoxRecipient}.
 *
 * Non-zero values cause the recipient to be skipped during notification delivery.
 */
export enum NotificationBoxRecipientFlag {
  /**
   * Recipient is active and will receive notifications. This is the default; not stored in Firestore.
   */
  ENABLED = 0,
  /**
   * Recipient is administratively disabled (e.g., by the box owner).
   */
  DISABLED = 1,
  /**
   * Recipient opted themselves out from receiving notifications.
   */
  OPT_OUT = 2
}

/**
 * Recipient entry embedded in a {@link NotificationBox}. Combines contact info with per-template channel configs.
 *
 * When `uid` is set, contact details are resolved from the user's profile at send time.
 * The `i` field (from {@link IndexRef}) tracks the recipient's position and is synced with
 * the corresponding {@link NotificationUserNotificationBoxRecipientConfig} on the user side.
 *
 * Field abbreviations:
 * - `x` — excluded flag (set via {@link NotificationBoxSendExclusion})
 * - `c` — per-template channel config record
 * - `f` — opt-in/opt-out flag
 * - `lk` — locked flag (prevents box-side updates; user can still update their own config)
 */
export interface NotificationBoxRecipient extends NotificationRecipient, IndexRef {
  /**
   * Excluded flag. Set when the recipient is excluded via a {@link NotificationBoxSendExclusion} on their {@link NotificationUser}.
   * Can only be cleared by removing the exclusion from the user's exclusion list.
   */
  x?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Per-template channel configuration. Keys are {@link NotificationTemplateType} values.
   */
  c: NotificationBoxRecipientTemplateConfigRecord;
  /**
   * Opt-in/opt-out flag. Non-zero values prevent notification delivery to this recipient.
   */
  f?: Maybe<NotificationBoxRecipientFlag>;
  /**
   * Locked flag. When true, the box cannot modify this recipient's config — only the user can update via their {@link NotificationUser}.
   */
  lk?: Maybe<SavedToFirestoreIfTrue>;
}

/**
 * Creates a new {@link NotificationBoxRecipient} for a user with an empty config record.
 *
 * @param uid - the user's Firebase auth UID
 * @param i - the recipient's index position in the box's recipient array
 * @returns a new recipient entry with the given uid and index and an empty template config record
 */
export function newNotificationBoxRecipientForUid(uid: FirebaseAuthUserId, i: number): NotificationBoxRecipient {
  return {
    c: {},
    i,
    uid
  };
}

/**
 * Default/fallback notification config stored on a {@link NotificationUser}.
 *
 * Used as the base configuration for the user's direct/default config (`dc`) and global config override (`gc`).
 * Omits per-recipient fields (index, name, summary ID, uid, exclusion) that only apply to box-level entries.
 *
 * Field abbreviations:
 * - `lk` — locked flag (prevents box-side updates to this user's recipient entry)
 * - `bk` — blocked flag (prevents the box from re-adding this user)
 */
export interface NotificationUserDefaultNotificationBoxRecipientConfig extends Omit<NotificationBoxRecipient, 'i' | 'n' | 's' | 'uid' | 'x'> {
  /**
   * Locked flag. Prevents the NotificationBox from modifying this user's recipient config.
   */
  lk?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Blocked flag. Prevents the NotificationBox from re-adding this user as a recipient.
   */
  bk?: Maybe<SavedToFirestoreIfTrue>;
}

/**
 * Merges two {@link NotificationUserDefaultNotificationBoxRecipientConfig} objects, preferring defined values from `a` over `b`.
 *
 * @param a - primary config whose defined values take precedence
 * @param b - fallback config supplying values when `a` fields are undefined
 * @returns the merged config
 */
export function mergeNotificationUserDefaultNotificationBoxRecipientConfig(a: NotificationUserDefaultNotificationBoxRecipientConfig, b: NotificationUserDefaultNotificationBoxRecipientConfig): NotificationUserDefaultNotificationBoxRecipientConfig {
  const c = mergeNotificationBoxRecipientTemplateConfigRecords(a.c, b.c);

  const result: NotificationUserDefaultNotificationBoxRecipientConfig = {
    ...mergeObjects<NotificationUserDefaultNotificationBoxRecipientConfig>([a, b], KeyValueTypleValueFilter.UNDEFINED),
    c
  };

  return result;
}

/**
 * Per-box notification config stored on a {@link NotificationUser}, mirroring the user's {@link NotificationBoxRecipient} entry.
 *
 * The `i` field tracks the user's index in the box's recipient array. Changes here are synced
 * bidirectionally with the corresponding {@link NotificationBox} during server-side sync.
 *
 * Field abbreviations:
 * - `nb` — NotificationBox ID this config mirrors
 * - `rm` — removed flag (user self-removed from the box)
 * - `ns` — needs-sync flag
 * - `lk` — locked flag (prevents box-side updates)
 * - `bk` — blocked flag (prevents re-addition to the box)
 */
export interface NotificationUserNotificationBoxRecipientConfig extends Omit<NotificationBoxRecipient, 'uid'> {
  /**
   * ID of the {@link NotificationBox} this config mirrors. The related model key can be inferred via {@link inferNotificationBoxRelatedModelKey}.
   */
  nb: NotificationBoxId;
  /**
   * Self-removal flag. When set, the user has removed themselves from this box.
   *
   * Only the box owner can restore a removed user. Users typically prefer the `f` (opt-out) flag instead,
   * which stops delivery without removing the subscription. The config is retained unless the user explicitly deletes it.
   */
  rm?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Whether this config needs to be synced with the corresponding {@link NotificationBox} recipient entry.
   */
  ns?: Maybe<NeedsSyncBoolean>;
  /**
   * Locked flag. Prevents the box from modifying this user's recipient config.
   */
  lk?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Blocked flag. Prevents the box from re-adding this user as a recipient.
   */
  bk?: Maybe<SavedToFirestoreIfTrue>;
}

/**
 * Bit positions for encoding {@link NotificationBoxRecipientTemplateConfig} as a {@link BitwiseEncodedSet}.
 *
 * Each channel has an ON and OFF bit. If neither is set, the channel inherits from the parent config.
 * This encoding allows compact storage of per-template preferences in Firestore.
 */
export enum NotificationBoxRecipientTemplateConfigBoolean {
  SEND_ALL_ON = 0,
  SEND_ALL_OFF = 1,
  EMAIL = 2,
  EMAIL_OFF = 3,
  TEXT = 4,
  TEXT_OFF = 5,
  PUSH_NOTIFICATION = 6,
  PUSH_NOTIFICATION_OFF = 7,
  NOTIFICATION_SUMMARY = 8,
  NOTIFICATION_SUMMARY_OFF = 9
}

/**
 * Bitwise-encoded form of {@link NotificationBoxRecipientTemplateConfig}, stored as a number in Firestore
 * for space efficiency. Decoded via the internal `notificationBoxRecipientTemplateConfigDencoder`.
 */
export type EncodedNotificationBoxRecipientTemplateConfig = BitwiseEncodedSet;

/**
 * Map of {@link NotificationTemplateType} to per-channel configuration for a recipient.
 *
 * Stored on {@link NotificationBoxRecipient} and {@link NotificationUserNotificationBoxRecipientConfig}.
 * Template types with all channels disabled should be omitted to save space.
 */
export type NotificationBoxRecipientTemplateConfigRecord = Record<NotificationTemplateType, NotificationBoxRecipientTemplateConfig>;

/**
 * Merges two {@link NotificationBoxRecipientTemplateConfigRecord} objects, preferring defined values from `a`.
 *
 * @param a - primary record whose defined values take precedence
 * @param b - fallback record supplying values when `a` entries are undefined
 * @returns the merged template config record
 */
export function mergeNotificationBoxRecipientTemplateConfigRecords(a: NotificationBoxRecipientTemplateConfigRecord, b: NotificationBoxRecipientTemplateConfigRecord): NotificationBoxRecipientTemplateConfigRecord {
  const mergeConfigs = mergeObjectsFunction<NotificationBoxRecipientTemplateConfigRecord>(KeyValueTypleValueFilter.UNDEFINED);
  return mergeConfigs([a, b]) as NotificationBoxRecipientTemplateConfigRecord;
}

/**
 * Bitwise-encoded form of {@link NotificationBoxRecipientTemplateConfigRecord}, with each template type
 * mapped to its {@link EncodedNotificationBoxRecipientTemplateConfig} number.
 */
export type EncodedNotificationBoxRecipientTemplateConfigRecord = Record<NotificationTemplateType, EncodedNotificationBoxRecipientTemplateConfig>;

const notificationBoxRecipientTemplateConfigDencoder = bitwiseObjectDencoder<NotificationBoxRecipientTemplateConfig, NotificationBoxRecipientTemplateConfigBoolean>({
  maxIndex: NotificationBoxRecipientTemplateConfigBoolean.NOTIFICATION_SUMMARY_OFF + 1,
  toSetFunction: (x) => {
    const set = new Set<NotificationBoxRecipientTemplateConfigBoolean>();

    if (x.sd != null) {
      set.add(x.sd ? NotificationBoxRecipientTemplateConfigBoolean.SEND_ALL_ON : NotificationBoxRecipientTemplateConfigBoolean.SEND_ALL_OFF);
    }

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

    if (x.has(NotificationBoxRecipientTemplateConfigBoolean.SEND_ALL_ON)) {
      object.sd = true;
    } else if (x.has(NotificationBoxRecipientTemplateConfigBoolean.SEND_ALL_OFF)) {
      object.sd = false;
    }

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

/**
 * Creates a Firestore field converter for {@link NotificationBoxRecipientTemplateConfigRecord},
 * using bitwise encoding for compact storage.
 *
 * @returns a Firestore field converter that encodes and decodes template config records using bitwise encoding
 */
export function firestoreNotificationBoxRecipientTemplateConfigRecord() {
  return firestoreBitwiseObjectMap<NotificationBoxRecipientTemplateConfig, NotificationTemplateType>({
    dencoder: notificationBoxRecipientTemplateConfigDencoder
  });
}

/**
 * Firestore sub-object converter for {@link NotificationBoxRecipient}.
 */
export const firestoreNotificationBoxRecipient = firestoreSubObject<NotificationBoxRecipient>({
  objectField: {
    fields: {
      i: firestoreNumber({ default: UNSET_INDEX_NUMBER }),
      uid: optionalFirestoreString(),
      n: optionalFirestoreString(),
      t: optionalFirestoreString(),
      e: optionalFirestoreString(),
      s: optionalFirestoreString(),
      f: optionalFirestoreEnum<NotificationBoxRecipientFlag>({ dontStoreIf: NotificationBoxRecipientFlag.ENABLED }),
      c: firestoreNotificationBoxRecipientTemplateConfigRecord(),
      lk: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      x: optionalFirestoreBoolean({ dontStoreValueIf: false })
    }
  }
});

/**
 * Firestore sub-object converter for {@link NotificationUserDefaultNotificationBoxRecipientConfig}.
 */
export const firestoreNotificationUserDefaultNotificationBoxRecipientConfig = firestoreSubObject<NotificationUserDefaultNotificationBoxRecipientConfig>({
  objectField: {
    fields: {
      lk: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      bk: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      t: optionalFirestoreString(),
      e: optionalFirestoreString(),
      f: optionalFirestoreEnum<NotificationBoxRecipientFlag>({ dontStoreIf: NotificationBoxRecipientFlag.ENABLED }),
      c: firestoreNotificationBoxRecipientTemplateConfigRecord()
    }
  }
});

/**
 * Firestore sub-object converter for {@link NotificationUserNotificationBoxRecipientConfig}.
 */
export const firestoreNotificationUserNotificationBoxRecipientConfig = firestoreSubObject<NotificationUserNotificationBoxRecipientConfig>({
  objectField: {
    fields: {
      nb: firestoreModelIdString,
      rm: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      ns: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      lk: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      bk: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      i: firestoreNumber({ default: UNSET_INDEX_NUMBER }),
      x: optionalFirestoreBoolean({ dontStoreValueIf: false }),
      n: optionalFirestoreString(),
      t: optionalFirestoreString(),
      e: optionalFirestoreString(),
      s: optionalFirestoreString(),
      f: optionalFirestoreEnum<NotificationBoxRecipientFlag>({ dontStoreIf: NotificationBoxRecipientFlag.ENABLED }),
      c: firestoreNotificationBoxRecipientTemplateConfigRecord()
    }
  }
});

/**
 * Array-form entry of a {@link NotificationBoxRecipientTemplateConfig} with its template type key.
 *
 * Used for UI display where iterating over an array is more convenient than a record.
 */
export interface NotificationBoxRecipientTemplateConfigArrayEntry extends NotificationBoxRecipientTemplateConfig {
  /**
   * The template type this config entry belongs to.
   */
  type: NotificationTemplateType;
}

/**
 * Array form of {@link NotificationBoxRecipientTemplateConfigRecord} for UI consumption.
 */
export type NotificationBoxRecipientTemplateConfigArray = NotificationBoxRecipientTemplateConfigArrayEntry[];

/**
 * Converts a {@link NotificationBoxRecipientTemplateConfigRecord} to an array of entries with their type keys.
 *
 * @param input - the template config record to convert
 * @returns an array of entries each containing a type key and the corresponding channel config
 *
 * @example
 * ```ts
 * const array = notificationBoxRecipientTemplateConfigRecordToArray({ 'comment': { se: true } });
 * // array === [{ type: 'comment', se: true }]
 * ```
 */
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

/**
 * Converts a {@link NotificationBoxRecipientTemplateConfigArray} back to a {@link NotificationBoxRecipientTemplateConfigRecord}.
 *
 * @param input - the array of typed config entries to convert
 * @returns a record keyed by template type
 */
export function notificationBoxRecipientTemplateConfigArrayToRecord(input: NotificationBoxRecipientTemplateConfigArray): NotificationBoxRecipientTemplateConfigRecord {
  const map: NotificationBoxRecipientTemplateConfigRecord = {};

  input.forEach((x) => {
    map[x.type] = {
      sd: x.sd,
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
 * Mixin interface for objects that can optionally trigger a notification on save/update.
 *
 * Used in API parameter types to let callers opt in or out of notification delivery for an action.
 */
export interface SendNotificationRef {
  sendNotification?: Maybe<boolean>;
}
