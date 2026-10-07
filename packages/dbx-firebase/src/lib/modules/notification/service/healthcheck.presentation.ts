/**
 * @module healthcheck.presentation
 *
 * Presentation metadata for notification health check findings.
 *
 * Issue codes are intentionally open-ended — apps and delivery providers emit their own — so the UI
 * needs a way to attach a label and an icon to a code it does not know about. Every issue already
 * carries its own user-facing `m` (message) and `f` (suggested fix), so a registered entry never
 * restates the finding: an unregistered code still renders correctly, just with a status-derived label
 * and icon instead of a code-specific one.
 *
 * An entry may also say how to lay out the finding's structured detail (`d`) for an admin, and how to
 * describe the admin's fix for it. Neither is part of the finding itself.
 */
import { type ArrayOrValue, type Maybe, type Minutes, type Seconds } from '@dereekb/util';
import { type DbxThemeColor } from '@dereekb/dbx-web';
import {
  type NotificationHealthCheckIssue,
  type NotificationHealthCheckIssueCode,
  type NotificationHealthCheckIssueData,
  KnownNotificationHealthCheckIssueCode,
  MailgunNotificationHealthCheckIssueCode,
  NotificationDeliveryMethod,
  NotificationHealthCheckStatus,
  TwilioNotificationHealthCheckIssueCode
} from '@dereekb/firebase';

/**
 * One labelled value from a finding's structured detail, for an admin reviewing it.
 */
export interface DbxFirebaseNotificationHealthCheckIssueDetail {
  /**
   * Short label for the value, e.g. `Unsubscribed`.
   */
  readonly label: string;
  /**
   * The value. A Date is rendered as a date.
   */
  readonly value: string | Date;
}

/**
 * Lays out a finding's structured detail as labelled values.
 *
 * Given the detail as it was read, which can come from Firestore or straight from a function result, so a
 * date in it may be a Date, a Firestore Timestamp, or a string. Read dates through
 * {@link readNotificationHealthCheckIssueDataDate}.
 */
export type DbxFirebaseNotificationHealthCheckIssueDetailsFunction = (data: NotificationHealthCheckIssueData, issue: NotificationHealthCheckIssue) => DbxFirebaseNotificationHealthCheckIssueDetail[];

/**
 * How to present the admin's automatic fix for a finding.
 */
export interface DbxFirebaseNotificationHealthCheckAutofixPresentation {
  /**
   * Label for the fix button, e.g. `Resubscribe`.
   */
  readonly label?: Maybe<string>;
  /**
   * What the fix does, as a full sentence. Shown in the confirmation before it runs.
   */
  readonly description?: Maybe<string>;
  /**
   * Shown first in the confirmation of an {@link NotificationHealthCheckIssueAutofixType.EXPLICIT} fix,
   * saying what the recipient chose and when it is acceptable to override it.
   */
  readonly warning?: Maybe<string>;
}

/**
 * How a single {@link NotificationHealthCheckIssueCode} should be presented.
 *
 * Deliberately carries no message text for the finding: the issue itself is the authority on what to say.
 */
export interface DbxFirebaseNotificationHealthCheckPresentationEntry {
  /**
   * The issue code this entry presents.
   */
  readonly code: NotificationHealthCheckIssueCode;
  /**
   * Short label for the finding, shown on its status chip.
   */
  readonly label?: Maybe<string>;
  /**
   * Material icon name for the finding.
   */
  readonly icon?: Maybe<string>;
  /**
   * Overrides the colour that would otherwise be derived from the issue's status.
   *
   * Rarely useful, and unset on every library default: the same code is emitted at different
   * severities depending on what was found (a recent delivery failure is an error when permanent and
   * a warning when temporary), so the status is the more accurate source.
   */
  readonly color?: Maybe<DbxThemeColor>;
  /**
   * Lays out the finding's structured detail for an admin view, such as when an address unsubscribed and
   * from which email.
   *
   * Only shown where the report is asked to show detail. A user-facing report leaves it out.
   */
  readonly details?: Maybe<DbxFirebaseNotificationHealthCheckIssueDetailsFunction>;
  /**
   * How to present the fix for a finding its provider marked as fixable.
   *
   * Without it, the fix still renders with a generic label and description.
   */
  readonly autofix?: Maybe<DbxFirebaseNotificationHealthCheckAutofixPresentation>;
}

/**
 * A fully resolved presentation for one finding.
 */
export interface DbxFirebaseNotificationHealthCheckIssuePresentation {
  readonly label: string;
  readonly icon: string;
  readonly color: DbxThemeColor;
}

/**
 * A fully resolved presentation for a finding's automatic fix.
 */
export interface DbxFirebaseNotificationHealthCheckIssueAutofixPresentation {
  readonly label: string;
  readonly description: string;
  /**
   * Set only for an {@link NotificationHealthCheckIssueAutofixType.EXPLICIT} fix.
   */
  readonly warning?: Maybe<string>;
}

/**
 * The fix presentation for a finding whose entry does not describe its fix.
 */
export const DEFAULT_NOTIFICATION_HEALTH_CHECK_AUTOFIX_PRESENTATION: DbxFirebaseNotificationHealthCheckIssueAutofixPresentation & { readonly warning: string } = {
  label: 'Fix',
  description: 'Asks the delivery provider to fix this issue.',
  warning: 'This fix overrides a choice the recipient made. Only continue if they have explicitly asked for it.'
};

/**
 * Reads a date out of a finding's structured detail.
 *
 * The detail is stored as-is, so a date written as a Date is read back from Firestore as a Timestamp and
 * arrives from a function result as an ISO string. This accepts all three.
 *
 * @param value - The value to read.
 * @returns The date, or undefined when the value is not one.
 */
export function readNotificationHealthCheckIssueDataDate(value: unknown): Maybe<Date> {
  let date: Maybe<Date>;

  if (value instanceof Date) {
    date = value;
  } else if (typeof (value as Maybe<{ toDate?: unknown }>)?.toDate === 'function') {
    date = (value as { toDate: () => Date }).toDate();
  } else if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    date = Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return date;
}

/**
 * Collects the details whose value is present, dropping the rest.
 *
 * @param details - Label and value pairs, where the value may be missing.
 * @returns The details that have a value.
 */
function presentNotificationHealthCheckIssueDetails(details: { readonly label: string; readonly value: Maybe<string | Date> }[]): DbxFirebaseNotificationHealthCheckIssueDetail[] {
  return details.filter((x): x is DbxFirebaseNotificationHealthCheckIssueDetail => x.value != null && x.value !== '');
}

/**
 * Describes which mail an unsubscribe covers.
 *
 * Mailgun records an unsubscribe from everything with the `*` tag, and one from a category with that
 * category's tag.
 *
 * @param tags - The unsubscribe record's tags.
 * @returns A short description of what the address unsubscribed from.
 */
function mailgunUnsubscribeScope(tags: unknown): string {
  const tagList = Array.isArray(tags) ? (tags as string[]) : [];
  return tagList.length === 0 || tagList.includes('*') ? 'All email' : `Only email tagged ${tagList.join(', ')}`;
}

/**
 * Formats the subject of the email that triggered a suppression.
 *
 * @param subject - The subject, if the triggering event was found.
 * @returns The quoted subject, or undefined.
 */
function triggeringEmailSubject(subject: unknown): Maybe<string> {
  return typeof subject === 'string' && subject ? `"${subject}"` : undefined;
}

/**
 * App-level tuning for the notification delivery health check UI.
 *
 * These windows are ENFORCED BY THE SERVER; the client only counts down to them so it can disable an
 * action instead of letting the user trigger a call that comes back as an error. So every value here
 * must match what the server was configured with — declare it once in a package both sides import
 * rather than writing the number down twice, or the UI will offer a test message the server rejects.
 */
export abstract class DbxFirebaseNotificationHealthCheckConfig {
  /**
   * How long a user must wait between test messages on a single delivery method.
   *
   * Defaults to {@link DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLE_MINUTES}.
   */
  abstract readonly probeThrottleMinutes?: Maybe<Minutes>;
  /**
   * How long a user must wait between health check runs.
   *
   * Defaults to {@link DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_THROTTLE_MINUTES}.
   */
  abstract readonly runThrottleMinutes?: Maybe<Minutes>;
  /**
   * How long the client must wait between verifications of an in-flight test message.
   *
   * Defaults to {@link DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_VERIFY_THROTTLE_SECONDS}. This is also
   * the cadence the client polls at, so it must match the server's window: pace faster and every other
   * poll comes back rejected.
   */
  abstract readonly verifyThrottleSeconds?: Maybe<Seconds>;
  /**
   * How long to keep watching a test message before giving up on it.
   *
   * Defaults to {@link DEFAULT_NOTIFICATION_HEALTH_CHECK_PROBE_WATCH_MINUTES}. Purely a client-side
   * stop: a provider that never records an outcome would otherwise be polled for as long as the page
   * stays open. Once it passes, the probe is left pending and the next full run settles it.
   */
  abstract readonly probeWatchMinutes?: Maybe<Minutes>;
}

/**
 * How long the client keeps watching an in-flight test message before giving up on it.
 *
 * Comfortably longer than a provider takes to record a delivery outcome — the point is to stop polling
 * a provider that is never going to answer, not to impose a deadline of the client's own.
 */
export const DEFAULT_NOTIFICATION_HEALTH_CHECK_PROBE_WATCH_MINUTES: Minutes = 20;

/**
 * Configuration for the {@link DbxFirebaseNotificationHealthCheckPresentationService}.
 */
export abstract class DbxFirebaseNotificationHealthCheckPresentationServiceConfig {
  /**
   * App-specific entries to register, layered over the library defaults.
   */
  abstract readonly entries?: Maybe<ArrayOrValue<DbxFirebaseNotificationHealthCheckPresentationEntry>>;
  /**
   * Whether to register the library's default entries. Defaults to true.
   */
  abstract readonly registerDefaultEntries?: Maybe<boolean>;
}

/**
 * Colour for each health check status.
 *
 * `WARNING` and `ERROR` deliberately share `warn` — the palette has no distinct error tone — so they
 * are told apart by their icons instead.
 */
export const NOTIFICATION_HEALTH_CHECK_STATUS_COLORS: Record<NotificationHealthCheckStatus, DbxThemeColor> = {
  [NotificationHealthCheckStatus.OK]: 'success',
  [NotificationHealthCheckStatus.WARNING]: 'warn',
  [NotificationHealthCheckStatus.ERROR]: 'warn',
  [NotificationHealthCheckStatus.PENDING]: 'notice',
  [NotificationHealthCheckStatus.SKIPPED]: 'grey',
  [NotificationHealthCheckStatus.UNKNOWN]: 'grey'
};

/**
 * Icon for each health check status. Also what distinguishes a warning from an error.
 */
export const NOTIFICATION_HEALTH_CHECK_STATUS_ICONS: Record<NotificationHealthCheckStatus, string> = {
  [NotificationHealthCheckStatus.OK]: 'check_circle',
  [NotificationHealthCheckStatus.WARNING]: 'warning',
  [NotificationHealthCheckStatus.ERROR]: 'error',
  [NotificationHealthCheckStatus.PENDING]: 'hourglass_top',
  [NotificationHealthCheckStatus.SKIPPED]: 'remove_circle_outline',
  [NotificationHealthCheckStatus.UNKNOWN]: 'help'
};

/**
 * Human-readable label for each health check status.
 *
 * Used as the chip label for an issue code with no registered entry.
 */
export const NOTIFICATION_HEALTH_CHECK_STATUS_LABELS: Record<NotificationHealthCheckStatus, string> = {
  [NotificationHealthCheckStatus.OK]: 'OK',
  [NotificationHealthCheckStatus.WARNING]: 'Warning',
  [NotificationHealthCheckStatus.ERROR]: 'Problem',
  [NotificationHealthCheckStatus.PENDING]: 'Pending',
  [NotificationHealthCheckStatus.SKIPPED]: 'Not Checked',
  [NotificationHealthCheckStatus.UNKNOWN]: 'Unknown'
};

/**
 * Human-readable label for each delivery method.
 */
export const NOTIFICATION_DELIVERY_METHOD_LABELS: Record<NotificationDeliveryMethod, string> = {
  [NotificationDeliveryMethod.EMAIL]: 'Email',
  [NotificationDeliveryMethod.TEXT]: 'Text Message',
  [NotificationDeliveryMethod.PUSH]: 'Push Notification',
  [NotificationDeliveryMethod.NOTIFICATION_SUMMARY]: 'In-App Notification'
};

/**
 * Icon for each delivery method.
 */
export const NOTIFICATION_DELIVERY_METHOD_ICONS: Record<NotificationDeliveryMethod, string> = {
  [NotificationDeliveryMethod.EMAIL]: 'mail',
  [NotificationDeliveryMethod.TEXT]: 'sms',
  [NotificationDeliveryMethod.PUSH]: 'notifications',
  [NotificationDeliveryMethod.NOTIFICATION_SUMMARY]: 'inbox'
};

/**
 * Label for each delivery method's "send a test message" action.
 *
 * Always names what the method actually delivers — "Send Test Email", "Send Test Text Message" — rather
 * than a generic "Send Test Message", so the button says which of a user's contact details it is about
 * to send something real to.
 */
export const NOTIFICATION_DELIVERY_METHOD_TEST_MESSAGE_LABELS: Record<NotificationDeliveryMethod, string> = {
  [NotificationDeliveryMethod.EMAIL]: 'Send Test Email',
  [NotificationDeliveryMethod.TEXT]: 'Send Test Text Message',
  [NotificationDeliveryMethod.PUSH]: 'Send Test Push Notification',
  [NotificationDeliveryMethod.NOTIFICATION_SUMMARY]: 'Send Test In-App Notification'
};

/**
 * Noun for what each delivery method's test message actually is, for use mid-sentence.
 *
 * Lowercase because it reads inside prose — "A test text message was sent recently."
 */
export const NOTIFICATION_DELIVERY_METHOD_TEST_MESSAGE_NOUNS: Record<NotificationDeliveryMethod, string> = {
  [NotificationDeliveryMethod.EMAIL]: 'test email',
  [NotificationDeliveryMethod.TEXT]: 'test text message',
  [NotificationDeliveryMethod.PUSH]: 'test push notification',
  [NotificationDeliveryMethod.NOTIFICATION_SUMMARY]: 'test in-app notification'
};

/**
 * Short name for each delivery method, for a label that has to stay compact.
 *
 * Used to compose the probe chips — `Test Email Sent`, `Test Text Sent` — where the full
 * {@link NOTIFICATION_DELIVERY_METHOD_LABELS} wording would make the chip too long to scan.
 */
export const NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS: Record<NotificationDeliveryMethod, string> = {
  [NotificationDeliveryMethod.EMAIL]: 'Email',
  [NotificationDeliveryMethod.TEXT]: 'Text',
  [NotificationDeliveryMethod.PUSH]: 'Push',
  [NotificationDeliveryMethod.NOTIFICATION_SUMMARY]: 'In-App'
};

/**
 * What each probe lifecycle code says happened to the test message.
 *
 * The other half of the composed probe chip label — see {@link notificationHealthCheckProbeIssueLabel}.
 */
export const NOTIFICATION_HEALTH_CHECK_PROBE_ISSUE_OUTCOMES: Record<NotificationHealthCheckIssueCode, string> = {
  [KnownNotificationHealthCheckIssueCode.PROBE_PENDING]: 'Sent',
  [KnownNotificationHealthCheckIssueCode.PROBE_DELIVERED]: 'Delivered',
  [KnownNotificationHealthCheckIssueCode.PROBE_FAILED]: 'Failed',
  [KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED]: 'Not Sent',
  [MailgunNotificationHealthCheckIssueCode.PROBE_NOT_CONFIGURED]: 'Unavailable'
};

/**
 * The chip label for a probe lifecycle finding, naming the delivery method it belongs to.
 *
 * Every provider emits the same probe codes, so these labels cannot be fixed strings in the presentation
 * registry the way every other code's is: the same `probeDelivered` finding should read `Test Email
 * Delivered` in the email section and `Test Text Delivered` in the text section.
 *
 * @param code - The issue code to label.
 * @param method - The delivery method whose section the finding is rendered in.
 * @returns The composed label, or undefined when the code is not a probe lifecycle code.
 */
export function notificationHealthCheckProbeIssueLabel(code: NotificationHealthCheckIssueCode, method: NotificationDeliveryMethod): Maybe<string> {
  const outcome = NOTIFICATION_HEALTH_CHECK_PROBE_ISSUE_OUTCOMES[code];
  return outcome == null ? undefined : `Test ${NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS[method] ?? 'Message'} ${outcome}`;
}

/**
 * Presentation entries for every issue code the library, the Mailgun email check and the Twilio text check emit.
 *
 * None of them set a colour — see {@link DbxFirebaseNotificationHealthCheckPresentationEntry.color}.
 */
export const DEFAULT_NOTIFICATION_HEALTH_CHECK_PRESENTATION_ENTRIES: DbxFirebaseNotificationHealthCheckPresentationEntry[] = [
  // configuration
  { code: KnownNotificationHealthCheckIssueCode.SEND_SERVICE_NOT_CONFIGURED, label: 'Not Available', icon: 'block' },
  { code: KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE, label: 'Not Verified', icon: 'help' },
  { code: KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET, label: 'No Destination', icon: 'person_off' },
  { code: KnownNotificationHealthCheckIssueCode.RECIPIENT_OPTED_OUT, label: 'Opted Out', icon: 'unsubscribe' },
  { code: KnownNotificationHealthCheckIssueCode.RECIPIENT_DISABLED, label: 'Turned Off', icon: 'notifications_off' },
  { code: KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_GLOBALLY, label: 'Off Everywhere', icon: 'notifications_off' },
  { code: KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_TEMPLATE, label: 'Off For This Type', icon: 'notifications_paused' },
  { code: KnownNotificationHealthCheckIssueCode.METHOD_NOT_ENABLED_FOR_ANY_TEMPLATE, label: 'Off For Every Type', icon: 'notifications_paused' },
  { code: KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_BOX, label: 'Off For A Subscription', icon: 'notifications_paused' },
  // subscriptions
  { code: KnownNotificationHealthCheckIssueCode.NO_NOTIFICATION_BOXES, label: 'No Subscriptions', icon: 'inbox' },
  { code: KnownNotificationHealthCheckIssueCode.NOTIFICATION_BOX_EXCLUSIONS, label: 'Suppressed', icon: 'filter_alt_off' },
  { code: KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC, label: 'Still Saving', icon: 'sync_problem' },
  { code: KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_BROKEN, label: 'Broken Subscription', icon: 'link_off' },
  { code: KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_NOT_READY, label: 'Still Setting Up', icon: 'hourglass_top' },
  // probe. These labels are only the fallback for a finding rendered without a delivery method in hand:
  // given one, notificationHealthCheckProbeIssueLabel() names it — `Test Email Sent`, `Test Text Sent`.
  { code: KnownNotificationHealthCheckIssueCode.PROBE_PENDING, label: 'Test Sent', icon: 'hourglass_top' },
  { code: KnownNotificationHealthCheckIssueCode.PROBE_DELIVERED, label: 'Test Delivered', icon: 'mark_email_read' },
  { code: KnownNotificationHealthCheckIssueCode.PROBE_FAILED, label: 'Test Failed', icon: 'error' },
  { code: KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED, label: 'Test Not Sent', icon: 'error' },
  // mailgun
  {
    code: MailgunNotificationHealthCheckIssueCode.SUPPRESSED_BOUNCE,
    label: 'Blocked After Bounce',
    icon: 'block',
    details: (d) =>
      presentNotificationHealthCheckIssueDetails([
        { label: 'Bounced', value: readNotificationHealthCheckIssueDataDate(d['createdAt']) },
        { label: 'Server response', value: [d['code'], d['error']].filter((x) => x != null && x !== '').join(' ') }
      ]),
    autofix: {
      label: 'Remove Block',
      description: "Removes this address from the email provider's bounce list, so email is sent to it again. If the address still cannot receive mail, the next email will bounce and block it again."
    }
  },
  {
    code: MailgunNotificationHealthCheckIssueCode.SUPPRESSED_COMPLAINT,
    label: 'Blocked After Spam Report',
    icon: 'report',
    details: (d) =>
      presentNotificationHealthCheckIssueDetails([
        { label: 'Reported', value: readNotificationHealthCheckIssueDataDate(d['createdAt']) },
        { label: 'Reported email', value: triggeringEmailSubject(d['subject']) }
      ]),
    autofix: {
      label: 'Remove Block',
      description: "Removes this address from the email provider's spam complaint list, so email is delivered to it again.",
      warning: 'This address reported one of our emails as spam. Only remove the block if the recipient has explicitly asked to receive our email again.'
    }
  },
  {
    code: MailgunNotificationHealthCheckIssueCode.SUPPRESSED_UNSUBSCRIBE,
    label: 'Unsubscribed',
    icon: 'unsubscribe',
    details: (d) =>
      presentNotificationHealthCheckIssueDetails([
        { label: 'Unsubscribed', value: readNotificationHealthCheckIssueDataDate(d['createdAt']) },
        { label: 'From', value: mailgunUnsubscribeScope(d['tags']) },
        { label: 'Unsubscribed from email', value: triggeringEmailSubject(d['subject']) }
      ]),
    autofix: {
      label: 'Resubscribe',
      description: "Removes this address from the email provider's unsubscribe list, so email is delivered to it again."
    }
  },
  {
    code: MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE,
    label: 'Recent Delivery Failed',
    icon: 'error',
    details: (d) =>
      presentNotificationHealthCheckIssueDetails([
        { label: 'Failed', value: readNotificationHealthCheckIssueDataDate(d['at']) },
        { label: 'Severity', value: typeof d['severity'] === 'string' ? d['severity'] : undefined }
      ])
  },
  { code: MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS, label: 'Recently Delivered', icon: 'mark_email_read' },
  { code: MailgunNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY, label: 'No Recent Activity', icon: 'history_toggle_off' },
  { code: MailgunNotificationHealthCheckIssueCode.DOMAIN_NOT_ACTIVE, label: 'Sending System Down', icon: 'dns' },
  { code: MailgunNotificationHealthCheckIssueCode.ADDRESS_UNDELIVERABLE, label: 'Address Undeliverable', icon: 'person_off' },
  { code: MailgunNotificationHealthCheckIssueCode.ADDRESS_DISPOSABLE, label: 'Disposable Address', icon: 'delete_forever' },
  { code: MailgunNotificationHealthCheckIssueCode.PROBE_NOT_CONFIGURED, label: 'Test Unavailable', icon: 'block' },
  // twilio
  { code: TwilioNotificationHealthCheckIssueCode.RECIPIENT_OPTED_OUT, label: 'Replied STOP', icon: 'unsubscribe' },
  {
    code: TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE,
    label: 'Recent Text Failed',
    icon: 'error',
    details: (d) =>
      presentNotificationHealthCheckIssueDetails([
        { label: 'Failed', value: readNotificationHealthCheckIssueDataDate(d['at']) },
        { label: 'Error code', value: typeof d['errorCode'] === 'number' ? String(d['errorCode']) : undefined }
      ])
  },
  { code: TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS, label: 'Recently Delivered', icon: 'mark_chat_read' },
  { code: TwilioNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY, label: 'No Recent Activity', icon: 'history_toggle_off' },
  { code: TwilioNotificationHealthCheckIssueCode.ACCOUNT_NOT_ACTIVE, label: 'Sending System Down', icon: 'dns' },
  { code: TwilioNotificationHealthCheckIssueCode.SENDER_NOT_REGISTERED, label: 'Sender Not Registered', icon: 'gpp_bad' },
  { code: TwilioNotificationHealthCheckIssueCode.NUMBER_INVALID, label: 'Invalid Number', icon: 'phone_disabled' },
  { code: TwilioNotificationHealthCheckIssueCode.NUMBER_LANDLINE, label: 'Landline Number', icon: 'phone_disabled' },
  { code: TwilioNotificationHealthCheckIssueCode.PROBE_NOT_CONFIGURED, label: 'Test Unavailable', icon: 'block' }
];
