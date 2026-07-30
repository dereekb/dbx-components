/**
 * @module notification.healthcheck
 *
 * Types describing the outcome of a notification delivery health check — a self-serve
 * diagnosis of why a given user is or is not receiving notifications on each delivery method.
 *
 * A health check produces one {@link NotificationDeliveryHealthCheckResult} per delivery method
 * ({@link NotificationDeliveryMethod}), each carrying zero or more {@link NotificationHealthCheckIssue}
 * findings and, optionally, a {@link NotificationHealthCheckProbe} describing a real test message
 * that was dispatched through that method.
 *
 * Issue codes are intentionally open-ended: {@link KnownNotificationHealthCheckIssueCode} covers the
 * checks the library performs itself, while apps and delivery providers are free to emit their own
 * codes for provider-specific findings (e.g. an address on a Mailgun suppression list).
 */
import { filterMaybeArrayValues, type Maybe, type Minutes, type Seconds } from '@dereekb/util';
import { addMinutes, addSeconds } from 'date-fns';
import { firestoreDate, firestoreEnum, firestoreObjectArray, firestoreString, firestoreSubObject, optionalFirestoreBoolean, optionalFirestoreDate, optionalFirestoreField, optionalFirestoreString } from '../../common';
import { type NotificationTemplateType } from './notification.id';

/**
 * A delivery method (channel) that notifications can be sent through.
 *
 * The values mirror the per-method flags on {@link NotificationBoxRecipientTemplateConfig}
 * (`se`/`st`/`sp`/`sn`), so a method maps directly onto the config field that gates it.
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
 * The outcome of a health check, or of one individual finding within it.
 */
export enum NotificationHealthCheckStatus {
  /**
   * Everything that was checked looks healthy.
   */
  OK = 'ok',
  /**
   * Something looks off, but delivery is probably still working.
   */
  WARNING = 'warn',
  /**
   * Delivery is blocked or broken.
   */
  ERROR = 'error',
  /**
   * Waiting on an asynchronous result, such as an in-flight delivery probe.
   */
  PENDING = 'pending',
  /**
   * Not checked. Either the method is not configured for this app, or no check was available.
   */
  SKIPPED = 'skipped',
  /**
   * The check ran but could not reach a conclusion, such as when a provider API was unreachable.
   */
  UNKNOWN = 'unknown'
}

/**
 * Severity ranking used to roll several statuses up into one.
 *
 * Higher wins. `ERROR` outranks `PENDING` so that a method with a known problem is not masked by an
 * unrelated in-flight probe, and `SKIPPED` ranks lowest so an unconfigured method never drags a
 * report down.
 */
export const NOTIFICATION_HEALTH_CHECK_STATUS_SEVERITY: Record<NotificationHealthCheckStatus, number> = {
  [NotificationHealthCheckStatus.SKIPPED]: 0,
  [NotificationHealthCheckStatus.OK]: 1,
  [NotificationHealthCheckStatus.UNKNOWN]: 2,
  [NotificationHealthCheckStatus.PENDING]: 3,
  [NotificationHealthCheckStatus.WARNING]: 4,
  [NotificationHealthCheckStatus.ERROR]: 5
};

/**
 * Rolls a set of statuses up into the single most severe one.
 *
 * @param statuses - The statuses to roll up.
 * @returns The most severe status, or {@link NotificationHealthCheckStatus.SKIPPED} if none were given.
 *
 * @example
 * ```ts
 * rollupNotificationHealthCheckStatus([NotificationHealthCheckStatus.OK, NotificationHealthCheckStatus.ERROR]);
 * // NotificationHealthCheckStatus.ERROR
 * ```
 */
export function rollupNotificationHealthCheckStatus(statuses: NotificationHealthCheckStatus[]): NotificationHealthCheckStatus {
  let result = NotificationHealthCheckStatus.SKIPPED;

  statuses.forEach((x) => {
    if (NOTIFICATION_HEALTH_CHECK_STATUS_SEVERITY[x] > NOTIFICATION_HEALTH_CHECK_STATUS_SEVERITY[result]) {
      result = x;
    }
  });

  return result;
}

/**
 * True if the status represents a problem the user should act on.
 *
 * @param status - The status to test.
 * @returns True for errors and warnings; false for statuses that need no action.
 */
export function isProblemNotificationHealthCheckStatus(status: NotificationHealthCheckStatus): boolean {
  return status === NotificationHealthCheckStatus.ERROR || status === NotificationHealthCheckStatus.WARNING;
}

/**
 * Issue codes emitted by the health checks the library performs itself.
 *
 * Apps and delivery providers may emit additional codes of their own — see
 * {@link NotificationHealthCheckIssueCode}.
 */
export enum KnownNotificationHealthCheckIssueCode {
  /**
   * The server has no send service configured for this delivery method, so nothing will ever be sent through it.
   */
  SEND_SERVICE_NOT_CONFIGURED = 'sendServiceNotConfigured',
  /**
   * No send service health check is available for this delivery method, so only configuration was inspected.
   */
  SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE = 'sendServiceHealthCheckUnavailable',
  /**
   * No delivery target could be resolved for this method — e.g. no email address on the auth record and no override.
   */
  NO_DELIVERY_TARGET = 'noDeliveryTarget',
  /**
   * The recipient has opted out of all notifications.
   */
  RECIPIENT_OPTED_OUT = 'recipientOptedOut',
  /**
   * The recipient's notifications are disabled.
   */
  RECIPIENT_DISABLED = 'recipientDisabled',
  /**
   * This delivery method is switched off by the user's global or default configuration.
   */
  METHOD_DISABLED_GLOBALLY = 'methodDisabledGlobally',
  /**
   * This delivery method is switched off for the notification template type that was checked.
   */
  METHOD_DISABLED_FOR_TEMPLATE = 'methodDisabledForTemplate',
  /**
   * This delivery method is switched off for one or more of the user's individual notification boxes.
   */
  METHOD_DISABLED_FOR_BOX = 'methodDisabledForBox',
  /**
   * The user is not subscribed to any notification boxes, so no model-driven notifications will reach them.
   */
  NO_NOTIFICATION_BOXES = 'noNotificationBoxes',
  /**
   * The user has notification box exclusions that suppress notifications from matching boxes.
   */
  NOTIFICATION_BOX_EXCLUSIONS = 'notificationBoxExclusions',
  /**
   * The user's configuration has not finished syncing to their notification boxes.
   */
  NEEDS_CONFIG_SYNC = 'needsConfigSync',
  /**
   * One or more of the user's subscriptions is broken and will never send.
   */
  SUBSCRIPTION_BROKEN = 'subscriptionBroken',
  /**
   * One or more of the user's subscriptions has not finished being set up, so its notifications are delayed.
   */
  SUBSCRIPTION_NOT_READY = 'subscriptionNotReady',
  /**
   * A test message was dispatched and its outcome is not known yet.
   */
  PROBE_PENDING = 'probePending',
  /**
   * A test message was confirmed delivered.
   */
  PROBE_DELIVERED = 'probeDelivered',
  /**
   * A test message failed to deliver.
   */
  PROBE_FAILED = 'probeFailed',
  /**
   * A test message could not be dispatched at all.
   */
  PROBE_DISPATCH_FAILED = 'probeDispatchFailed'
}

/**
 * The code identifying what a {@link NotificationHealthCheckIssue} describes.
 *
 * Library checks use {@link KnownNotificationHealthCheckIssueCode}; apps and delivery providers may
 * use any other string to describe provider-specific findings.
 */
export type NotificationHealthCheckIssueCode = KnownNotificationHealthCheckIssueCode | string;

/**
 * Structured detail attached to a {@link NotificationHealthCheckIssue}.
 *
 * Stored directly in Firestore, so values must be Firestore-compatible and should be kept small.
 */
export type NotificationHealthCheckIssueData = Readonly<Record<string, any>>;

/**
 * A single finding produced by a health check.
 *
 * Field abbreviations:
 * - `c` — issue code
 * - `s` — status/severity
 * - `m` — human-readable message
 * - `f` — suggested fix
 * - `d` — structured detail
 */
export interface NotificationHealthCheckIssue {
  /**
   * Identifies what was found. See {@link KnownNotificationHealthCheckIssueCode}.
   */
  c: NotificationHealthCheckIssueCode;
  /**
   * How severe the finding is.
   */
  s: NotificationHealthCheckStatus;
  /**
   * Human-readable statement of what was found, suitable for showing to the affected user.
   */
  m: string;
  /**
   * What the user (or an admin) can do about it, when there is a known remedy.
   */
  f?: Maybe<string>;
  /**
   * Structured detail backing the finding, for display or debugging.
   */
  d?: Maybe<NotificationHealthCheckIssueData>;
}

/**
 * The human-facing content of a {@link NotificationHealthCheckIssue}.
 */
export interface NotificationHealthCheckIssueContent {
  /**
   * Human-readable statement of what was found, suitable for showing to the affected user.
   */
  readonly message: string;
  /**
   * What the user (or an admin) can do about it, when there is a known remedy.
   */
  readonly fix?: Maybe<string>;
  /**
   * Structured detail backing the finding, for display or debugging.
   */
  readonly data?: Maybe<NotificationHealthCheckIssueData>;
}

/**
 * Creates a {@link NotificationHealthCheckIssue}.
 *
 * @param code - The issue code.
 * @param status - The severity.
 * @param content - The message, plus an optional suggested fix and structured detail.
 * @returns The issue.
 *
 * @example
 * ```ts
 * notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET, NotificationHealthCheckStatus.ERROR, {
 *   message: 'There is no email address on your account.',
 *   fix: 'Add an email address to your account.'
 * });
 * ```
 */
export function notificationHealthCheckIssue(code: NotificationHealthCheckIssueCode, status: NotificationHealthCheckStatus, content: NotificationHealthCheckIssueContent): NotificationHealthCheckIssue {
  return { c: code, s: status, m: content.message, f: content.fix, d: content.data };
}

/**
 * A real test message dispatched through a delivery method in order to observe whether it arrives.
 *
 * Delivery confirmation is asynchronous for most providers, so a probe is recorded when it is
 * dispatched and resolved on a later health check run.
 *
 * Field abbreviations:
 * - `id` — provider correlation id
 * - `at` — dispatch time
 * - `s` — current status
 * - `tg` — delivery target
 * - `d` — provider detail
 */
export interface NotificationHealthCheckProbe {
  /**
   * Provider-specific id used to correlate the dispatched message with its delivery outcome.
   * For email this is the provider's message id.
   */
  id: string;
  /**
   * When the probe was dispatched.
   */
  at: Date;
  /**
   * The probe's current status. {@link NotificationHealthCheckStatus.PENDING} until the provider
   * reports an outcome.
   */
  s: NotificationHealthCheckStatus;
  /**
   * The delivery target the probe was sent to.
   */
  tg: string;
  /**
   * Provider detail about the outcome, once known — typically the failure reason.
   */
  d?: Maybe<string>;
}

/**
 * True if the probe is still awaiting an outcome and should be re-checked.
 *
 * @param probe - The probe to test, if one exists.
 * @returns True if the probe is pending.
 */
export function isPendingNotificationHealthCheckProbe(probe: Maybe<NotificationHealthCheckProbe>): boolean {
  return probe?.s === NotificationHealthCheckStatus.PENDING;
}

/**
 * The correlation id of a probe the provider gave nothing to track it by.
 *
 * Empty rather than absent because the field is what a provider looks the outcome up with, and there is
 * nothing to look up — such a probe is always recorded already settled, so it is never queried.
 */
export const UNTRACKABLE_NOTIFICATION_HEALTH_CHECK_PROBE_ID = '';

/**
 * Records a dispatch attempt the provider gave no way to track.
 *
 * A send that produced no correlation id still happened, and the test message window is derived from the
 * recorded probe — so an attempt recorded as nothing at all would leave the server's throttle and the
 * client's countdown with nothing to key on, making the action look successful and be immediately
 * repeatable. Always settled ({@link NotificationHealthCheckStatus.UNKNOWN} when the provider accepted it,
 * `ERROR` when it did not), never pending: there is no outcome coming for it.
 *
 * @param probe - The attempt's time, settled status, target, and provider detail.
 * @returns The probe recording the attempt.
 */
export function untrackableNotificationHealthCheckProbe(probe: Omit<NotificationHealthCheckProbe, 'id'>): NotificationHealthCheckProbe {
  return { ...probe, id: UNTRACKABLE_NOTIFICATION_HEALTH_CHECK_PROBE_ID };
}

/**
 * The result of checking a single delivery method.
 *
 * Field abbreviations:
 * - `me` — delivery method
 * - `s` — rolled-up status
 * - `tg` — resolved delivery target
 * - `is` — findings
 * - `pr` — delivery probe
 * - `pb` — whether a test message can be dispatched through this method
 */
export interface NotificationDeliveryHealthCheckResult {
  /**
   * The delivery method that was checked.
   */
  me: NotificationDeliveryMethod;
  /**
   * The most severe status across this method's findings and probe.
   */
  s: NotificationHealthCheckStatus;
  /**
   * The delivery target that was resolved for this method — an email address, phone number, or
   * NotificationSummary id. Absent when none could be resolved.
   */
  tg?: Maybe<string>;
  /**
   * Everything the check found for this method.
   */
  is: NotificationHealthCheckIssue[];
  /**
   * The probe dispatched through this method, if any. May still be pending.
   */
  pr?: Maybe<NotificationHealthCheckProbe>;
  /**
   * Whether a test message can actually be dispatched through this method — the provider exposes a
   * probe and a delivery target was resolved to send it to.
   *
   * Whether probing is supported is only knowable on the server, so it is reported here for a client
   * that offers a "send a test message" action: absent means no, and the action should not be offered.
   */
  pb?: Maybe<boolean>;
}

/**
 * A complete health check result, covering every delivery method that was checked.
 *
 * Field abbreviations:
 * - `at` — when the check ran
 * - `vat` — when its pending probes were last verified
 * - `s` — rolled-up status across the whole check
 * - `t` — notification template type the configuration was evaluated against
 * - `is` — account-wide findings
 * - `m` — per-method results
 */
export interface NotificationHealthCheck {
  /**
   * When the check was run.
   */
  at: Date;
  /**
   * When the check's pending probes were last verified.
   *
   * A verify-only run refreshes the probe findings without re-running the check, so it advances this
   * rather than `at` — otherwise polling an in-flight test message would keep pushing the user's own
   * run window out. Absent until a verify-only run has happened.
   */
  vat?: Maybe<Date>;
  /**
   * The most severe status across the account-wide findings and every checked method.
   */
  s: NotificationHealthCheckStatus;
  /**
   * The notification template type the per-template configuration was evaluated against.
   */
  t?: Maybe<NotificationTemplateType>;
  /**
   * Findings that apply to the account as a whole rather than to one delivery method — a disabled
   * account, a subscription that failed to sync, an opt-out that suppresses every method.
   */
  is: NotificationHealthCheckIssue[];
  /**
   * The result for each delivery method that was checked.
   */
  m: NotificationDeliveryHealthCheckResult[];
}

/**
 * Rolls a delivery method's findings and probe up into a single status.
 *
 * @param result - The per-method result, without its rolled-up status.
 * @returns The most severe status across the method's findings and probe.
 */
export function rollupNotificationDeliveryHealthCheckResultStatus(result: Pick<NotificationDeliveryHealthCheckResult, 'is' | 'pr'>): NotificationHealthCheckStatus {
  const statuses = result.is.map((x) => x.s);

  if (result.pr) {
    statuses.push(result.pr.s);
  }

  return rollupNotificationHealthCheckStatus(statuses);
}

/**
 * The delivery methods whose test message is still awaiting an outcome.
 *
 * A pending probe is the whole reason to keep watching a check: it is the one part of a report that
 * changes on its own, as the provider records what happened to the message. Both the client (which
 * polls until they settle) and the server (which only consults a provider it has something to ask
 * about) scope their work to exactly these methods.
 *
 * @param healthCheck - The health check to read.
 * @returns The methods carrying a pending probe, in report order. Empty when nothing is in flight.
 */
export function notificationHealthCheckPendingProbeMethods(healthCheck: Maybe<Pick<NotificationHealthCheck, 'm'>>): NotificationDeliveryMethod[] {
  return (healthCheck?.m ?? []).filter((x) => isPendingNotificationHealthCheckProbe(x.pr)).map((x) => x.me);
}

/**
 * Finds the result for a specific delivery method.
 *
 * @param healthCheck - The health check to read.
 * @param method - The delivery method to look for.
 * @returns The method's result, or undefined if the method was not checked.
 */
export function notificationDeliveryHealthCheckResultForMethod(healthCheck: Maybe<NotificationHealthCheck>, method: NotificationDeliveryMethod): Maybe<NotificationDeliveryHealthCheckResult> {
  return healthCheck?.m.find((x) => x.me === method);
}

/**
 * Every issue in a health check, account-wide findings first.
 *
 * @param healthCheck - The health check to read.
 * @returns All issues, account-wide first and then in method order.
 */
export function allNotificationHealthCheckIssues(healthCheck: Maybe<NotificationHealthCheck>): NotificationHealthCheckIssue[] {
  if (!healthCheck) {
    return [];
  }

  return [...healthCheck.is, ...healthCheck.m.flatMap((x) => x.is)];
}

/**
 * Rolls a whole health check up into a single status.
 *
 * @param healthCheck - The check's account-wide findings and per-method results.
 * @returns The most severe status across everything the check found.
 */
export function rollupNotificationHealthCheckResultStatus(healthCheck: Pick<NotificationHealthCheck, 'is' | 'm'>): NotificationHealthCheckStatus {
  return rollupNotificationHealthCheckStatus([...healthCheck.is.map((x) => x.s), ...healthCheck.m.map((x) => x.s)]);
}

// MARK: Throttle
/**
 * How long a user must wait between health check runs.
 *
 * A run calls out to each delivery provider and can dispatch real messages, so it is throttled against
 * the check stored on the NotificationUser rather than being runnable on demand.
 */
export const DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_THROTTLE_MINUTES: Minutes = 2;

/**
 * Input for {@link notificationUserHealthCheckNextRunAt}.
 */
export interface NotificationUserHealthCheckNextRunAtInput {
  /**
   * The check currently stored on the NotificationUser, if any.
   */
  readonly healthCheck?: Maybe<Pick<NotificationHealthCheck, 'at'>>;
  /**
   * Overrides {@link DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_THROTTLE_MINUTES}.
   */
  readonly throttleMinutes?: Maybe<Minutes>;
}

/**
 * The earliest time another health check may be run for a NotificationUser.
 *
 * Both the server (which enforces the throttle) and the client (which disables the action until then)
 * derive the window from the same stored check, so the UI cannot offer a run the server would reject.
 *
 * @param input - The stored check, and optionally a throttle window to use instead of the default.
 * @returns The time the next run is allowed, or undefined when no check has been run yet.
 */
export function notificationUserHealthCheckNextRunAt(input: NotificationUserHealthCheckNextRunAtInput): Maybe<Date> {
  const { healthCheck, throttleMinutes } = input;
  return healthCheck?.at == null ? undefined : addMinutes(healthCheck.at, throttleMinutes ?? DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_THROTTLE_MINUTES);
}

/**
 * How long a user must wait between test messages on a single delivery method.
 *
 * Throttled separately from — and more strictly than — a plain run: a probe delivers a real message to
 * the user, while a run only reads configuration and provider state. Running the check must therefore
 * not consume the test message allowance, and vice versa.
 *
 * Only the default. An app that wants a different cadence declares its own value and passes it to both
 * the server (which enforces the window) and the client (which counts down to it) — see
 * {@link NotificationUserHealthCheckNextProbeAtInput.throttleMinutes}. Both sides must use the same
 * value, or the UI will offer a test message the server rejects.
 */
export const DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLE_MINUTES: Minutes = 5;

/**
 * Input for {@link notificationUserHealthCheckNextProbeAt}.
 */
export interface NotificationUserHealthCheckNextProbeAtInput {
  /**
   * The check currently stored on the NotificationUser, if any.
   */
  readonly healthCheck?: Maybe<Pick<NotificationHealthCheck, 'm'>>;
  /**
   * The delivery methods the window is being computed for.
   *
   * Absent or empty considers every method that was checked, which is the window an unscoped test
   * message run answers to.
   */
  readonly methods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * Overrides {@link DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLE_MINUTES}.
   */
  readonly throttleMinutes?: Maybe<Minutes>;
}

/**
 * The earliest time another test message may be dispatched for a NotificationUser.
 *
 * The window is per delivery method: each method has its own test message action, so a test email must
 * not hold the test text message off. Pass the methods being probed to get their window — the most
 * recent probe among just those methods — and pass none for the window across every checked method.
 *
 * Both the server (which enforces the window) and the client (which disables the action until then)
 * derive it from the same stored check, so the UI cannot offer a test message the server would reject.
 *
 * @param input - The stored check, the methods being probed, and optionally a throttle window to use
 *   instead of the default.
 * @returns The time the next probe is allowed, or undefined when none of those methods has ever
 *   dispatched one.
 */
export function notificationUserHealthCheckNextProbeAt(input: NotificationUserHealthCheckNextProbeAtInput): Maybe<Date> {
  const { healthCheck, methods, throttleMinutes } = input;
  const scopedMethods = methods?.length ? new Set(methods) : undefined;
  const scopedResults = scopedMethods ? (healthCheck?.m ?? []).filter((x) => scopedMethods.has(x.me)) : (healthCheck?.m ?? []);
  const probeTimes = filterMaybeArrayValues(scopedResults.map((x) => x.pr?.at)).map((x) => x.getTime());
  const latestProbeAt = probeTimes.length > 0 ? new Date(Math.max(...probeTimes)) : undefined;
  return latestProbeAt == null ? undefined : addMinutes(latestProbeAt, throttleMinutes ?? DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLE_MINUTES);
}

// MARK: Verify
/**
 * How long a caller must wait between verifications of a check's pending probes.
 *
 * A verify-only run exists to be polled: a dispatched test message settles on the provider's schedule,
 * so something has to keep asking until it does. It is throttled far more loosely than a run or a probe
 * because it is far cheaper — it consults a provider only for a method with a probe actually in flight,
 * and touches nothing else — but it is throttled all the same, so a client cannot poll a provider's API
 * in a tight loop.
 *
 * Seconds rather than minutes: the point of the verification is that the outcome appears while the user
 * is still looking at the report.
 */
export const DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_VERIFY_THROTTLE_SECONDS: Seconds = 15;

/**
 * Input for {@link notificationUserHealthCheckNextVerifyAt}.
 */
export interface NotificationUserHealthCheckNextVerifyAtInput {
  /**
   * The check currently stored on the NotificationUser, if any.
   */
  readonly healthCheck?: Maybe<Pick<NotificationHealthCheck, 'vat'>>;
  /**
   * Overrides {@link DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_VERIFY_THROTTLE_SECONDS}.
   */
  readonly throttleSeconds?: Maybe<Seconds>;
}

/**
 * The earliest time a check's pending probes may be verified again.
 *
 * Derived from `vat` rather than `at`, so verifying an in-flight test message neither answers to nor
 * consumes the user's run window. Both the server (which enforces the window) and the client (which
 * paces its polling to it) derive it the same way.
 *
 * @param input - The stored check, and optionally a window to use instead of the default.
 * @returns The time the next verification is allowed, or undefined when none has happened yet.
 */
export function notificationUserHealthCheckNextVerifyAt(input: NotificationUserHealthCheckNextVerifyAtInput): Maybe<Date> {
  const { healthCheck, throttleSeconds } = input;
  return healthCheck?.vat == null ? undefined : addSeconds(healthCheck.vat, throttleSeconds ?? DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_VERIFY_THROTTLE_SECONDS);
}

/**
 * The earliest time another test message may be dispatched through each of a check's delivery methods.
 *
 * The per-method form of {@link notificationUserHealthCheckNextProbeAt}, for a UI that renders one test
 * message action per method and needs every method's window at once.
 *
 * @param input - The stored check, and optionally a throttle window to use instead of the default.
 * @returns The time the next probe is allowed on each checked method. A method that has never
 *   dispatched a probe maps to undefined.
 */
export function notificationUserHealthCheckNextProbeAtByMethod(input: Omit<NotificationUserHealthCheckNextProbeAtInput, 'methods'>): NotificationDeliveryMethodMap<Maybe<Date>> {
  const { healthCheck, throttleMinutes } = input;
  const nextProbeAtByMethod: NotificationDeliveryMethodMap<Maybe<Date>> = {};

  (healthCheck?.m ?? []).forEach((methodResult) => {
    nextProbeAtByMethod[methodResult.me] = notificationUserHealthCheckNextProbeAt({ healthCheck, methods: [methodResult.me], throttleMinutes });
  });

  return nextProbeAtByMethod;
}

// MARK: Firestore
/**
 * Firestore sub-object converter for {@link NotificationHealthCheckIssue}.
 */
export const firestoreNotificationHealthCheckIssue = /* @__PURE__ */ firestoreSubObject<NotificationHealthCheckIssue>({
  objectField: {
    fields: {
      c: firestoreString({ default: '' }),
      s: firestoreEnum<NotificationHealthCheckStatus>({ default: NotificationHealthCheckStatus.UNKNOWN }),
      m: firestoreString({ default: '' }),
      f: optionalFirestoreString(),
      d: optionalFirestoreField<NotificationHealthCheckIssueData>()
    }
  }
});

/**
 * Firestore sub-object converter for {@link NotificationHealthCheckProbe}.
 */
export const firestoreNotificationHealthCheckProbe = /* @__PURE__ */ firestoreSubObject<NotificationHealthCheckProbe>({
  objectField: {
    fields: {
      id: firestoreString({ default: '' }),
      at: firestoreDate({ saveDefaultAsNow: true }),
      s: firestoreEnum<NotificationHealthCheckStatus>({ default: NotificationHealthCheckStatus.PENDING }),
      tg: firestoreString({ default: '' }),
      d: optionalFirestoreString()
    }
  }
});

const notificationHealthCheckProbeMapFunctions = firestoreNotificationHealthCheckProbe.mapFunctions;

/**
 * The Firestore data form of a {@link NotificationHealthCheckProbe}.
 */
export type NotificationHealthCheckProbeData = ReturnType<typeof notificationHealthCheckProbeMapFunctions.to>;

/**
 * Firestore sub-object converter for {@link NotificationDeliveryHealthCheckResult}.
 */
export const firestoreNotificationDeliveryHealthCheckResult = /* @__PURE__ */ firestoreSubObject<NotificationDeliveryHealthCheckResult>({
  objectField: {
    fields: {
      me: firestoreEnum<NotificationDeliveryMethod>({ default: NotificationDeliveryMethod.EMAIL }),
      s: firestoreEnum<NotificationHealthCheckStatus>({ default: NotificationHealthCheckStatus.UNKNOWN }),
      tg: optionalFirestoreString(),
      is: firestoreObjectArray({ objectField: firestoreNotificationHealthCheckIssue }),
      pr: optionalFirestoreField<NotificationHealthCheckProbe, NotificationHealthCheckProbeData>({
        transformFromData: (x) => notificationHealthCheckProbeMapFunctions.from(x),
        transformToData: (x) => notificationHealthCheckProbeMapFunctions.to(x)
      }),
      pb: optionalFirestoreBoolean()
    }
  }
});

/**
 * Firestore sub-object converter for {@link NotificationHealthCheck}.
 */
export const firestoreNotificationHealthCheck = /* @__PURE__ */ firestoreSubObject<NotificationHealthCheck>({
  objectField: {
    fields: {
      at: firestoreDate({ saveDefaultAsNow: true }),
      vat: optionalFirestoreDate(),
      s: firestoreEnum<NotificationHealthCheckStatus>({ default: NotificationHealthCheckStatus.UNKNOWN }),
      t: optionalFirestoreString(),
      is: firestoreObjectArray({ objectField: firestoreNotificationHealthCheckIssue }),
      m: firestoreObjectArray({ objectField: firestoreNotificationDeliveryHealthCheckResult })
    }
  }
});

const notificationHealthCheckMapFunctions = firestoreNotificationHealthCheck.mapFunctions;

/**
 * The Firestore data form of a {@link NotificationHealthCheck}.
 */
export type NotificationHealthCheckData = ReturnType<typeof notificationHealthCheckMapFunctions.to>;

/**
 * Field config for the optional {@link NotificationHealthCheck} stored on a NotificationUser.
 *
 * Unlike {@link firestoreNotificationHealthCheck}, this leaves the field absent instead of defaulting
 * to an empty check, so "never run" stays distinguishable from "ran and found nothing".
 */
export const optionalFirestoreNotificationHealthCheck = /* @__PURE__ */ optionalFirestoreField<NotificationHealthCheck, NotificationHealthCheckData>({
  transformFromData: (x) => notificationHealthCheckMapFunctions.from(x),
  transformToData: (x) => notificationHealthCheckMapFunctions.to(x)
});
