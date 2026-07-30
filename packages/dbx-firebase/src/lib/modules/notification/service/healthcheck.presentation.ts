/**
 * @module healthcheck.presentation
 *
 * Presentation metadata for notification health check findings.
 *
 * Issue codes are intentionally open-ended — apps and delivery providers emit their own — so the UI
 * needs a way to attach a label and an icon to a code it does not know about. Every issue already
 * carries its own user-facing `m` (message) and `f` (suggested fix), so a registered entry supplies
 * **presentation only, never copy**: an unregistered code still renders correctly, just with a
 * status-derived label and icon instead of a code-specific one.
 */
import { type ArrayOrValue, type Maybe, type Minutes } from '@dereekb/util';
import { type DbxThemeColor } from '@dereekb/dbx-web';
import { type NotificationHealthCheckIssueCode, KnownNotificationHealthCheckIssueCode, MailgunNotificationHealthCheckIssueCode, NotificationDeliveryMethod, NotificationHealthCheckStatus } from '@dereekb/firebase';

/**
 * How a single {@link NotificationHealthCheckIssueCode} should be presented.
 *
 * Deliberately carries no message text: the issue itself is the authority on what to say.
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
}

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
 * Presentation entries for every issue code the library and the Mailgun email check emit.
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
  { code: MailgunNotificationHealthCheckIssueCode.SUPPRESSED_BOUNCE, label: 'Blocked After Bounce', icon: 'block' },
  { code: MailgunNotificationHealthCheckIssueCode.SUPPRESSED_COMPLAINT, label: 'Blocked After Spam Report', icon: 'report' },
  { code: MailgunNotificationHealthCheckIssueCode.SUPPRESSED_UNSUBSCRIBE, label: 'Unsubscribed', icon: 'unsubscribe' },
  { code: MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE, label: 'Recent Delivery Failed', icon: 'error' },
  { code: MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS, label: 'Recently Delivered', icon: 'mark_email_read' },
  { code: MailgunNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY, label: 'No Recent Activity', icon: 'history_toggle_off' },
  { code: MailgunNotificationHealthCheckIssueCode.DOMAIN_NOT_ACTIVE, label: 'Sending System Down', icon: 'dns' },
  { code: MailgunNotificationHealthCheckIssueCode.ADDRESS_UNDELIVERABLE, label: 'Address Undeliverable', icon: 'person_off' },
  { code: MailgunNotificationHealthCheckIssueCode.ADDRESS_DISPOSABLE, label: 'Disposable Address', icon: 'delete_forever' },
  { code: MailgunNotificationHealthCheckIssueCode.PROBE_NOT_CONFIGURED, label: 'Test Unavailable', icon: 'block' }
];
