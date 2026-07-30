/**
 * @module notification.healthcheck.mailgun
 *
 * Issue codes emitted by the Mailgun-backed email health check.
 *
 * These live here, rather than next to the server-side check that emits them, so a browser can ship a
 * first-class presentation for each code without re-declaring the strings. The check itself stays in
 * `@dereekb/firebase-server/model` and imports these codes from here.
 */

/**
 * Issue codes emitted by the Mailgun email health check.
 *
 * These are Mailgun-specific and sit alongside the library's own
 * {@link KnownNotificationHealthCheckIssueCode} values.
 */
export enum MailgunNotificationHealthCheckIssueCode {
  /**
   * The address is on the domain's bounce suppression list, so Mailgun drops every message to it.
   */
  SUPPRESSED_BOUNCE = 'mailgunSuppressedBounce',
  /**
   * The address is on the domain's spam complaint list, so Mailgun drops every message to it.
   */
  SUPPRESSED_COMPLAINT = 'mailgunSuppressedComplaint',
  /**
   * The address is on the domain's unsubscribe list.
   */
  SUPPRESSED_UNSUBSCRIBE = 'mailgunSuppressedUnsubscribe',
  /**
   * A recent message to the address failed or was rejected.
   */
  RECENT_DELIVERY_FAILURE = 'mailgunRecentDeliveryFailure',
  /**
   * A recent message to the address was delivered successfully.
   */
  RECENT_DELIVERY_SUCCESS = 'mailgunRecentDeliverySuccess',
  /**
   * No email activity was recorded for the address in the window that was inspected.
   */
  NO_RECENT_ACTIVITY = 'mailgunNoRecentActivity',
  /**
   * The sending domain is not active, which blocks delivery for everyone.
   */
  DOMAIN_NOT_ACTIVE = 'mailgunDomainNotActive',
  /**
   * Address validation says the address cannot receive mail.
   */
  ADDRESS_UNDELIVERABLE = 'mailgunAddressUndeliverable',
  /**
   * The address belongs to a disposable email provider.
   */
  ADDRESS_DISPOSABLE = 'mailgunAddressDisposable',
  /**
   * A probe was requested but no probe message builder is configured.
   */
  PROBE_NOT_CONFIGURED = 'mailgunProbeNotConfigured'
}
