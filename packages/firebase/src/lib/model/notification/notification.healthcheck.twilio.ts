/**
 * @module notification.healthcheck.twilio
 *
 * Issue codes emitted by the Twilio-backed text message health check.
 *
 * These live here, rather than next to the server-side check that emits them, so a browser can ship a
 * first-class presentation for each code without re-declaring the strings. The check itself stays in
 * `@dereekb/firebase-server/twilio` and imports these codes from here.
 */

/**
 * Issue codes emitted by the Twilio text message health check.
 *
 * These are Twilio-specific and sit alongside the library's own
 * {@link KnownNotificationHealthCheckIssueCode} values.
 */
export enum TwilioNotificationHealthCheckIssueCode {
  /**
   * The number replied STOP to one of our texts, so Twilio blocks every text to it until it replies START.
   */
  RECIPIENT_OPTED_OUT = 'twilioRecipientOptedOut',
  /**
   * A recent text to the number failed or was not delivered.
   */
  RECENT_DELIVERY_FAILURE = 'twilioRecentDeliveryFailure',
  /**
   * A recent text to the number was delivered, or handed to its carrier.
   */
  RECENT_DELIVERY_SUCCESS = 'twilioRecentDeliverySuccess',
  /**
   * No text activity was recorded for the number in the window that was inspected.
   */
  NO_RECENT_ACTIVITY = 'twilioNoRecentActivity',
  /**
   * The Twilio account is not active, which blocks texts for everyone.
   */
  ACCOUNT_NOT_ACTIVE = 'twilioAccountNotActive',
  /**
   * The sending number is not registered with US carriers, which blocks texts for everyone.
   */
  SENDER_NOT_REGISTERED = 'twilioSenderNotRegistered',
  /**
   * Twilio Lookup says the number is not a valid phone number.
   */
  NUMBER_INVALID = 'twilioNumberInvalid',
  /**
   * Twilio Lookup says the number is a landline, which cannot receive texts.
   */
  NUMBER_LANDLINE = 'twilioNumberLandline',
  /**
   * A probe was requested but no probe message builder is configured.
   */
  PROBE_NOT_CONFIGURED = 'twilioProbeNotConfigured'
}
