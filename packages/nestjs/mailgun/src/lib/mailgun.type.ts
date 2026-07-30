import type Mailgun from 'mailgun.js';
import { type MailgunClientOptions } from 'node_modules/mailgun.js/Types/Types/MailgunClient/MailgunClientOptions';

export type MailgunOptions = MailgunClientOptions;
export type MailgunClient = ReturnType<Mailgun['client']>;
export type MailgunMessagesClient = MailgunClient['messages'];
export type MailgunSuppressionsClient = MailgunClient['suppressions'];
export type MailgunEventsClient = MailgunClient['events'];
export type MailgunValidationClient = MailgunClient['validate'];
export type MailgunDomainsClient = MailgunClient['domains'];

/**
 * A page of events returned by the Mailgun Events API.
 */
export type MailgunEventsList = Awaited<ReturnType<MailgunEventsClient['get']>>;

/**
 * A single event recorded by Mailgun for a message.
 *
 * Carries the delivery outcome (`event`), its `severity` for failures, and a `delivery-status` block
 * with the receiving server's response.
 */
export type MailgunDomainEvent = MailgunEventsList['items'][number];

/**
 * Query/filter for the Mailgun Events API.
 */
export type MailgunEventsQuery = NonNullable<Parameters<MailgunEventsClient['get']>[1]>;

/**
 * The result of validating a single email address via the Mailgun Validation API.
 */
export type MailgunEmailValidationResult = Awaited<ReturnType<MailgunValidationClient['get']>>;

/**
 * A bounce record on a domain's suppression list.
 *
 * While the address has a bounce record, Mailgun drops every message sent to it.
 */
export interface MailgunBounceSuppression {
  readonly address: string;
  /**
   * The SMTP status code the receiving server returned.
   */
  readonly code: number;
  /**
   * The receiving server's explanation of the bounce.
   */
  readonly error: string;
  readonly created_at: Date;
  readonly type?: string;
}

/**
 * A spam complaint record on a domain's suppression list.
 *
 * While the address has a complaint record, Mailgun drops every message sent to it.
 */
export interface MailgunComplaintSuppression {
  readonly address: string;
  readonly created_at: Date;
  readonly type?: string;
}

/**
 * An unsubscribe record on a domain's suppression list.
 */
export interface MailgunUnsubscribeSuppression {
  readonly address: string;
  /**
   * The message tags the address unsubscribed from. An empty list means all mail.
   */
  readonly tags?: string[];
  readonly created_at: Date;
  readonly type?: string;
}
