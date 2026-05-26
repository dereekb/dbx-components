import { type E164PhoneNumber } from '@dereekb/util';

/**
 * Twilio Account SID (starts with `AC`).
 */
export type TwilioAccountSid = string;

/**
 * Twilio Auth Token used for API authentication.
 */
export type TwilioAuthToken = string;

/**
 * Twilio API Key SID (starts with `SK`). Optional alternative to using the auth token directly.
 */
export type TwilioApiKeySid = string;

/**
 * Secret value paired with a TwilioApiKeySid.
 */
export type TwilioApiKeySecret = string;

/**
 * Twilio Messaging Service SID (starts with `MG`).
 */
export type TwilioMessagingServiceSid = string;

/**
 * Twilio Verify Service SID (starts with `VA`).
 */
export type TwilioVerifyServiceSid = string;

/**
 * Twilio Message SID (starts with `SM` or `MM`).
 */
export type TwilioMessageSid = string;

/**
 * URL of a Twilio status callback endpoint.
 */
export type TwilioStatusCallbackUrl = string;

/**
 * Phone number in E.164 format used as either a sender or recipient.
 */
export type TwilioPhoneNumber = E164PhoneNumber;

/**
 * Status values reported by Twilio for a Message resource.
 *
 * https://www.twilio.com/docs/sms/api/message-resource#message-status-values
 */
export type TwilioMessageStatus = 'accepted' | 'queued' | 'sending' | 'sent' | 'receiving' | 'received' | 'delivered' | 'undelivered' | 'failed' | 'read' | 'canceled' | 'scheduled' | 'partially_delivered';

/**
 * Status values reported by Twilio Verify for a verification attempt.
 *
 * https://www.twilio.com/docs/verify/api/verification#verification-properties
 */
export type TwilioVerificationStatus = 'pending' | 'approved' | 'canceled' | 'max_attempts_reached' | 'deleted' | 'failed' | 'expired';

/**
 * Channel a Twilio Verify verification is delivered through.
 */
export type TwilioVerifyChannel = 'sms' | 'call' | 'email' | 'whatsapp';
