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
import { type Maybe, type EmailAddress, type E164PhoneNumber, type BitwiseEncodedSet, bitwiseObjectDencoder, type IndexRef, type IndexNumber, forEachKeyValue, type NeedsSyncBoolean, updateMaybeValue, UNSET_INDEX_NUMBER, KeyValueTypleValueFilter, mergeObjects, filterUndefinedValues, type Building } from '@dereekb/util';
import { type NotificationBoxId, type NotificationSummaryId, type NotificationTemplateType } from './notification.id';
import { type FirebaseAuthUserId, firestoreBitwiseObjectMap, firestoreNumber, firestoreSubObject, optionalFirestoreArray, optionalFirestoreBoolean, optionalFirestoreDate, optionalFirestoreEnum, optionalFirestoreString, type SavedToFirestoreIfTrue, firestoreModelIdString } from '../../common';

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
  readonly sd?: Maybe<boolean>;
  /**
   * Email channel enabled/disabled.
   */
  readonly se?: Maybe<boolean>;
  /**
   * Text/SMS channel enabled/disabled.
   */
  readonly st?: Maybe<boolean>;
  /**
   * Push notification channel enabled/disabled.
   */
  readonly sp?: Maybe<boolean>;
  /**
   * In-app notification summary channel enabled/disabled.
   */
  readonly sn?: Maybe<boolean>;
}

/**
 * Merges two {@link NotificationBoxRecipientTemplateConfig} objects per channel, preferring values from `a` over `b`.
 *
 * A null/undefined channel on `a` is filled from `b`. Neither config is made effective first; to apply each level's `sd` before merging,
 * use {@link mergeEffectiveNotificationBoxRecipientTemplateConfigs}.
 *
 * @param a - Primary config whose defined values take precedence.
 * @param b - Fallback config supplying values when `a` fields are undefined.
 * @returns The merged template config with values from `a` preferred over `b`
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
 * @param a - The template config to resolve.
 * @returns The effective config with each channel flag filled in using the send-default fallback.
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

// MARK: Delivery Method
/**
 * A delivery method (channel) that notifications can be sent through.
 *
 * The values mirror the per-method flags on {@link NotificationBoxRecipientTemplateConfig}
 * (`se`/`st`/`sp`/`sn`), so a method maps directly onto the config field that gates it. See {@link NOTIFICATION_DELIVERY_METHOD_TEMPLATE_CONFIG_KEY}.
 */
export enum NotificationDeliveryMethod {
  /**
   * Email delivery. Gated by `se`.
   */
  EMAIL = 'e',
  /**
   * Text/SMS delivery. Gated by `st`.
   */
  TEXT = 't',
  /**
   * Push notification delivery. Gated by `sp`.
   */
  PUSH = 'p',
  /**
   * In-app delivery to a NotificationSummary. Gated by `sn`.
   */
  NOTIFICATION_SUMMARY = 'n'
}

/**
 * All delivery methods, in the order a report should present them.
 */
export const ALL_NOTIFICATION_DELIVERY_METHODS: NotificationDeliveryMethod[] = [NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.PUSH, NotificationDeliveryMethod.NOTIFICATION_SUMMARY];

/**
 * A value held per delivery method, for the methods it is known for.
 *
 * Partial because a health check only covers the methods it was asked about, so anything derived
 * from one covers those methods only.
 *
 * @template T - The per-method value.
 */
export type NotificationDeliveryMethodMap<T> = Partial<Record<NotificationDeliveryMethod, T>>;

/**
 * A {@link NotificationBoxRecipientTemplateConfig} key that gates a single {@link NotificationDeliveryMethod}.
 */
export type NotificationBoxRecipientTemplateConfigDeliveryMethodKey = 'se' | 'st' | 'sp' | 'sn';

/**
 * The {@link NotificationBoxRecipientTemplateConfig} key that gates each {@link NotificationDeliveryMethod}.
 */
export const NOTIFICATION_DELIVERY_METHOD_TEMPLATE_CONFIG_KEY: Readonly<Record<NotificationDeliveryMethod, NotificationBoxRecipientTemplateConfigDeliveryMethodKey>> = {
  [NotificationDeliveryMethod.EMAIL]: 'se',
  [NotificationDeliveryMethod.TEXT]: 'st',
  [NotificationDeliveryMethod.PUSH]: 'sp',
  [NotificationDeliveryMethod.NOTIFICATION_SUMMARY]: 'sn'
};

/**
 * Reads the flag a {@link NotificationBoxRecipientTemplateConfig} has set for the given delivery method.
 *
 * This is the raw channel value: `sd` is not applied. Pass the config through {@link effectiveNotificationBoxRecipientTemplateConfig}
 * first to read the effective value.
 *
 * @param config - The template config to read from.
 * @param method - The delivery method whose flag to read.
 * @returns The configured flag, or null/undefined when the config leaves the method unset.
 */
export function readNotificationDeliveryMethodFlag(config: Maybe<NotificationBoxRecipientTemplateConfig>, method: NotificationDeliveryMethod): Maybe<boolean> {
  return config?.[NOTIFICATION_DELIVERY_METHOD_TEMPLATE_CONFIG_KEY[method]];
}

/**
 * Returns the known delivery methods from the input, without duplicates and in the canonical {@link ALL_NOTIFICATION_DELIVERY_METHODS} order.
 *
 * @param methods - The delivery methods to canonicalize.
 * @returns The canonical delivery method list. Empty when the input is null/undefined or holds no known methods.
 */
export function toCanonicalNotificationDeliveryMethods(methods: Maybe<Iterable<NotificationDeliveryMethod>>): NotificationDeliveryMethod[] {
  const methodsSet = new Set(methods ?? []);
  return ALL_NOTIFICATION_DELIVERY_METHODS.filter((x) => methodsSet.has(x));
}

/**
 * Template-level opt-in rules that decide what a delivery method does for a recipient whose config leaves it unset.
 *
 * Defined on a {@link NotificationTemplateTypeInfo}, and overridable per-notification via `Notification.ois` / `Notification.ots`.
 */
export interface NotificationExplicitOptInConfig {
  /**
   * When true, only sends email, push and in-app notifications to recipients who have explicitly enabled this template type in their
   * {@link NotificationBoxRecipientTemplateConfig}. Recipients without an explicit opt-in are skipped.
   *
   * Defaults to false. Overridable per-notification via `Notification.ois`.
   */
  readonly onlySendToExplicitlyEnabledRecipients?: Maybe<boolean>;
  /**
   * When false, sends text/SMS to all recipients regardless of explicit opt-in status (still respects explicit opt-outs).
   *
   * Defaults to true, so texts are opt-in. Overridable per-notification via `Notification.ots`.
   */
  readonly onlyTextExplicitlyEnabledRecipients?: Maybe<boolean>;
}

/**
 * Returns whether the delivery method is sent to a recipient whose config leaves it unset.
 *
 * This is what a "Default" choice resolves to:
 * - Text is off unless `onlyTextExplicitlyEnabledRecipients` is explicitly false.
 * - Every other method is on unless `onlySendToExplicitlyEnabledRecipients` is true.
 *
 * @param method - The delivery method to check.
 * @param explicitOptIn - The template/notification opt-in rules.
 * @returns True if the method is sent by default.
 */
export function isNotificationDeliveryMethodEnabledByDefault(method: NotificationDeliveryMethod, explicitOptIn?: Maybe<NotificationExplicitOptInConfig>): boolean {
  return method === NotificationDeliveryMethod.TEXT ? explicitOptIn?.onlyTextExplicitlyEnabledRecipients === false : explicitOptIn?.onlySendToExplicitlyEnabledRecipients !== true;
}

/**
 * Merges template configs from multiple config levels into one effective config.
 *
 * The configs are ordered highest priority first. Each level is made effective FIRST (its own `sd` fills its unset channels, see
 * {@link effectiveNotificationBoxRecipientTemplateConfig}), then the first level that sets a channel decides it. A level's `sd` therefore
 * beats any channel set on a lower level.
 *
 * @param configs - The template configs, highest priority first. Null/undefined levels are skipped.
 * @returns The merged effective template config.
 *
 * @example
 * ```ts
 * mergeEffectiveNotificationBoxRecipientTemplateConfigs([{ sd: false }, { se: true }]);
 * // { sd: false, se: false, st: false, sp: false, sn: false }
 * ```
 */
export function mergeEffectiveNotificationBoxRecipientTemplateConfigs(configs: Maybe<NotificationBoxRecipientTemplateConfig>[]): NotificationBoxRecipientTemplateConfig {
  return configs.reduceRight<NotificationBoxRecipientTemplateConfig>((acc, x) => (x == null ? acc : mergeNotificationBoxRecipientTemplateConfigs(effectiveNotificationBoxRecipientTemplateConfig(x), acc)), {});
}

/**
 * What decided whether a delivery method is sent to a recipient. See {@link resolveNotificationDeliveryMethodDecisions}.
 */
export enum NotificationDeliveryMethodDecisionSource {
  /**
   * The recipient is suppressed entirely (opted out or excluded), so every method is off.
   */
  SUPPRESSED = 'suppressed',
  /**
   * The recipient disabled the delivery method account-wide.
   */
  DISABLED_METHOD = 'disabled_method',
  /**
   * A config level set the method. `configIndex` is the index of the level that decided it.
   */
  CONFIG = 'config',
  /**
   * No config level set the method, so the template's opt-in default decided it.
   */
  DEFAULT = 'default'
}

/**
 * Whether a delivery method is sent to a recipient, and what decided it.
 */
export interface NotificationDeliveryMethodDecision {
  /**
   * Whether the method is sent.
   */
  readonly send: boolean;
  /**
   * What decided `send`.
   */
  readonly source: NotificationDeliveryMethodDecisionSource;
  /**
   * The index of the config level that decided the method. Only set when `source` is {@link NotificationDeliveryMethodDecisionSource.CONFIG}.
   */
  readonly configIndex?: Maybe<IndexNumber>;
}

/**
 * A {@link NotificationDeliveryMethodDecision} for every delivery method.
 */
export type NotificationDeliveryMethodDecisions = Record<NotificationDeliveryMethod, NotificationDeliveryMethodDecision>;

/**
 * Input for {@link resolveNotificationDeliveryMethodDecisions}.
 */
export interface ResolveNotificationDeliveryMethodDecisionsInput {
  /**
   * The template config of each config level, highest priority first. Null/undefined levels are skipped.
   */
  readonly configs: Maybe<NotificationBoxRecipientTemplateConfig>[];
  /**
   * Delivery methods the recipient disabled. A disabled method is off regardless of the configs and the opt-in defaults.
   */
  readonly disabledDeliveryMethods?: Maybe<Iterable<NotificationDeliveryMethod>>;
  /**
   * The opt-in rules that decide a method no config level sets.
   */
  readonly explicitOptIn?: Maybe<NotificationExplicitOptInConfig>;
  /**
   * Whether the recipient is suppressed entirely (opted out or excluded). Turns every method off.
   */
  readonly suppressed?: Maybe<boolean>;
}

/**
 * Decides, per delivery method, whether a notification is sent to a recipient.
 *
 * Checked in order, the first match deciding:
 * 1. SUPPRESSED — the recipient is suppressed, so the method is off.
 * 2. DISABLED_METHOD — the method is in `disabledDeliveryMethods`, so it is off.
 * 3. CONFIG — the first config level (each made effective first, see {@link mergeEffectiveNotificationBoxRecipientTemplateConfigs}) that sets the method.
 * 4. DEFAULT — {@link isNotificationDeliveryMethodEnabledByDefault}.
 *
 * @param input - The config levels, disabled methods and opt-in rules to resolve against.
 * @returns A decision for every delivery method.
 */
export function resolveNotificationDeliveryMethodDecisions(input: ResolveNotificationDeliveryMethodDecisionsInput): NotificationDeliveryMethodDecisions {
  const { configs, explicitOptIn, suppressed } = input;
  const disabledDeliveryMethods = new Set(input.disabledDeliveryMethods ?? []);
  const effectiveConfigs = configs.map((x) => (x == null ? undefined : effectiveNotificationBoxRecipientTemplateConfig(x)));
  const decisions: Building<NotificationDeliveryMethodDecisions> = {};

  ALL_NOTIFICATION_DELIVERY_METHODS.forEach((method) => {
    let decision: NotificationDeliveryMethodDecision;

    if (suppressed) {
      decision = { send: false, source: NotificationDeliveryMethodDecisionSource.SUPPRESSED };
    } else if (disabledDeliveryMethods.has(method)) {
      decision = { send: false, source: NotificationDeliveryMethodDecisionSource.DISABLED_METHOD };
    } else {
      const configIndex = effectiveConfigs.findIndex((x) => readNotificationDeliveryMethodFlag(x, method) != null);

      decision =
        configIndex === -1
          ? { send: isNotificationDeliveryMethodEnabledByDefault(method, explicitOptIn), source: NotificationDeliveryMethodDecisionSource.DEFAULT }
          : { send: readNotificationDeliveryMethodFlag(effectiveConfigs[configIndex], method) === true, source: NotificationDeliveryMethodDecisionSource.CONFIG, configIndex };
    }

    decisions[method] = decision;
  });

  return decisions as NotificationDeliveryMethodDecisions;
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
 * @param a - Existing recipient to update.
 * @param b - Partial values to apply on top of the existing recipient.
 * @returns The updated recipient with merged values.
 */
export function updateNotificationRecipient(a: NotificationRecipient, b: Partial<NotificationRecipient>): NotificationRecipient {
  const { uid: inputUid, n: inputN, e: inputE, t: inputT, s: inputS } = b;

  const uid = updateMaybeValue(a.uid, inputUid);

  return {
    uid,
    n: updateMaybeValue(a.n, inputN),
    e: updateMaybeValue(a.e, inputE),
    t: updateMaybeValue(a.t, inputT),
    s: uid == null ? updateMaybeValue(a.s, inputS) : null // null if uid is defined
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
 * @param uid - The user's Firebase auth UID.
 * @param i - The recipient's index position in the box's recipient array.
 * @returns A new recipient entry with the given uid and index and an empty template config record.
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
  readonly lk?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Blocked flag. Prevents the NotificationBox from re-adding this user as a recipient.
   */
  readonly bk?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Delivery methods the user turned off account-wide, such as an SMS kill switch.
   *
   * A disabled method is never sent, regardless of the per-template configs and the template opt-in defaults.
   *
   * @dbxModelVariable disabledDeliveryMethods
   */
  readonly dm?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * When the user first opted in to text messages. Evidence of SMS consent only; it never gates sending.
   *
   * Server-managed and only set on the global config (`gc`). Clients cannot set it.
   *
   * @dbxModelVariable textConsentAt
   */
  readonly tcat?: Maybe<Date>;
}

/**
 * Merges two {@link NotificationUserDefaultNotificationBoxRecipientConfig} objects, preferring defined values from `a` over `b`.
 *
 * - Top-level fields: `a` wins when its value is not null/undefined.
 * - `c`: merged per template type and per channel, `a` winning. See {@link mergeNotificationBoxRecipientTemplateConfigRecords}.
 * - `dm`: the union of both lists.
 * - `tcat`: `a`'s value, falling back to `b`'s.
 *
 * @param a - Primary config whose defined values take precedence.
 * @param b - Fallback config supplying values when `a` fields are undefined.
 * @returns The merged config.
 */
export function mergeNotificationUserDefaultNotificationBoxRecipientConfig(a: NotificationUserDefaultNotificationBoxRecipientConfig, b: NotificationUserDefaultNotificationBoxRecipientConfig): NotificationUserDefaultNotificationBoxRecipientConfig {
  const c = mergeNotificationBoxRecipientTemplateConfigRecords(a.c, b.c);
  const dm = a.dm == null && b.dm == null ? undefined : toCanonicalNotificationDeliveryMethods([...(a.dm ?? []), ...(b.dm ?? [])]);

  const result: NotificationUserDefaultNotificationBoxRecipientConfig = {
    ...mergeObjects<NotificationUserDefaultNotificationBoxRecipientConfig>([b, a], KeyValueTypleValueFilter.NULL),
    c,
    dm,
    tcat: a.tcat ?? b.tcat
  };

  return result;
}

/**
 * Returns whether the config disables the delivery method account-wide via its `dm` list.
 *
 * @param config - The NotificationUser global/default config.
 * @param method - The delivery method to check.
 * @returns True if the method is disabled.
 */
export function isNotificationDeliveryMethodDisabled(config: Maybe<Pick<NotificationUserDefaultNotificationBoxRecipientConfig, 'dm'>>, method: NotificationDeliveryMethod): boolean {
  return config?.dm?.includes(method) ?? false;
}

/**
 * Returns whether the config opts in to the delivery method: the method is not disabled, and at least one template type's
 * effective config (see {@link effectiveNotificationBoxRecipientTemplateConfig}) explicitly enables it.
 *
 * Used to detect when a user first opts in to text messages, to record SMS consent.
 *
 * @param config - The NotificationUser global/default config.
 * @param method - The delivery method to check.
 * @returns True if the config opts in to the method.
 */
export function hasNotificationDeliveryMethodOptIn(config: Maybe<Pick<NotificationUserDefaultNotificationBoxRecipientConfig, 'c' | 'dm'>>, method: NotificationDeliveryMethod): boolean {
  return config != null && !isNotificationDeliveryMethodDisabled(config, method) && Object.values(config.c ?? {}).some((x) => readNotificationDeliveryMethodFlag(effectiveNotificationBoxRecipientTemplateConfig(x), method) === true);
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
  readonly nb: NotificationBoxId;
  /**
   * Self-removal flag. When set, the user has removed themselves from this box.
   *
   * Only the box owner can restore a removed user. Users typically prefer the `f` (opt-out) flag instead,
   * which stops delivery without removing the subscription. The config is retained unless the user explicitly deletes it.
   */
  readonly rm?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Whether this config needs to be synced with the corresponding {@link NotificationBox} recipient entry.
   */
  readonly ns?: Maybe<NeedsSyncBoolean>;
  /**
   * Locked flag. Prevents the box from modifying this user's recipient config.
   */
  readonly lk?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Blocked flag. Prevents the box from re-adding this user as a recipient.
   */
  readonly bk?: Maybe<SavedToFirestoreIfTrue>;
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
 * Merges two {@link NotificationBoxRecipientTemplateConfigRecord} objects per template type and per channel, preferring defined values from `a`.
 *
 * Each template type present in either record is merged with {@link mergeNotificationBoxRecipientTemplateConfigs}, so a channel `a` leaves unset
 * is filled from `b`.
 *
 * @param a - Primary record whose defined values take precedence.
 * @param b - Fallback record supplying values when `a` entries are undefined.
 * @returns The merged template config record.
 *
 * @example
 * ```ts
 * mergeNotificationBoxRecipientTemplateConfigRecords({ x: { se: true } }, { x: { se: false, st: true }, y: { sn: false } });
 * // { x: { se: true, st: true }, y: { sn: false } }
 * ```
 */
export function mergeNotificationBoxRecipientTemplateConfigRecords(a: Maybe<NotificationBoxRecipientTemplateConfigRecord>, b: Maybe<NotificationBoxRecipientTemplateConfigRecord>): NotificationBoxRecipientTemplateConfigRecord {
  const result: NotificationBoxRecipientTemplateConfigRecord = {};
  const types = new Set<NotificationTemplateType>([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);

  types.forEach((type) => {
    result[type] = filterUndefinedValues(mergeNotificationBoxRecipientTemplateConfigs(a?.[type], b?.[type]));
  });

  return result;
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
    const object: Building<NotificationBoxRecipientTemplateConfig> = {};

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
 * @returns A Firestore field converter that encodes and decodes template config records using bitwise encoding.
 *
 * @__NO_SIDE_EFFECTS__
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
      c: firestoreNotificationBoxRecipientTemplateConfigRecord(),
      dm: optionalFirestoreArray<NotificationDeliveryMethod>({ filterUnique: true, dontStoreIfEmpty: true }),
      tcat: optionalFirestoreDate()
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
 * @param input - Template config record keyed by template type.
 * @returns Flattened entries combining each template type with its channel config.
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
 * @param input - Flattened entries that include the template type and channel config.
 * @returns Template config record keyed by template type.
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
