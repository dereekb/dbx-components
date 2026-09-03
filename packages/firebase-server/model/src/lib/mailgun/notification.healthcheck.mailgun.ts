/**
 * @module notification.healthcheck.mailgun
 *
 * Mailgun-backed diagnostics for the email delivery method.
 *
 * This is where "the user says they aren't getting emails" turns into an actual answer. In practice the
 * cause is almost always one of:
 *
 * - the address is on the domain's **suppression list** (a past bounce or spam complaint), after which
 *   Mailgun silently drops every subsequent message to it
 * - recent messages to the address were **rejected or failed**, with a reason Mailgun recorded
 * - nothing was ever sent to the address at all, which points upstream at configuration
 * - the sending **domain** itself is not active
 *
 * All four are readable from Mailgun without sending anything. When that is not conclusive, an opt-in
 * probe sends a real message and resolves its outcome from the Events API. Resolution is asynchronous —
 * Mailgun records the outcome seconds after the send — so the probe is recorded as pending and settled
 * by a later verification, which the client polls for automatically. Nothing here ever asks the user to
 * come back and check for themselves.
 */
import { type EmailAddress, type Maybe, type Minutes, type PromiseOrValue } from '@dereekb/util';
import { type FirebaseAuthUserId, type NotificationHealthCheckIssue, type NotificationHealthCheckProbe, NotificationHealthCheckStatus, notificationHealthCheckIssue, untrackableNotificationHealthCheckProbe, KnownNotificationHealthCheckIssueCode, MailgunNotificationHealthCheckIssueCode } from '@dereekb/firebase';
import {
  type MailgunDomainEvent,
  type MailgunEmailMessageSendResult,
  type MailgunRecipient,
  type MailgunService,
  type MailgunTemplateEmailRequest,
  MailgunEventName,
  MailgunEventSeverity,
  bareMailgunMessageId,
  mailgunDomainEventDate,
  mailgunDomainEventFailureReason,
  mailgunDomainState,
  mailgunEventsForMessageId,
  mailgunRecentEventsForRecipient,
  mailgunSuppressionsForRecipient,
  mailgunValidateEmail
} from '@dereekb/nestjs/mailgun';
import { type NotificationEmailSendServiceHealthCheckService, type NotificationSendServiceHealthCheckRequest, type NotificationSendServiceHealthCheckResponse } from '../notification/notification.healthcheck.service';

/**
 * How long a dispatched probe may stay unresolved before it is reported as failed.
 *
 * Mailgun normally records a `delivered` or `failed` event within seconds; a probe with no event after
 * this long is not going to arrive.
 */
export const DEFAULT_MAILGUN_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES = 15;

// The codes this check emits live in @dereekb/firebase as MailgunNotificationHealthCheckIssueCode, so a
// browser can ship a presentation for each one. Import them from there rather than from here.

/**
 * Input for building the test email dispatched as a delivery probe.
 */
export interface MailgunNotificationHealthCheckProbeBuilderInput {
  /**
   * The Mailgun service, for reading the configured sender and client url.
   */
  readonly mailgunService: MailgunService;
  /**
   * The recipient to send the probe to.
   */
  readonly recipient: MailgunRecipient;
  /**
   * The user the health check is running for.
   */
  readonly uid: FirebaseAuthUserId;
}

/**
 * Builds the test email dispatched as a delivery probe.
 *
 * The message should be recognizable to whoever receives it — it lands in a real inbox, unannounced,
 * because someone asked the system to check whether their email works.
 */
export type MailgunNotificationHealthCheckProbeBuilder = (input: MailgunNotificationHealthCheckProbeBuilderInput) => PromiseOrValue<MailgunTemplateEmailRequest>;

/**
 * Configuration for {@link mailgunNotificationEmailSendServiceHealthCheckService}.
 */
export interface MailgunNotificationEmailSendServiceHealthCheckServiceConfig {
  /**
   * The Mailgun service to diagnose against.
   */
  readonly mailgunService: MailgunService;
  /**
   * Builds the probe message. Probing is unavailable when this is not provided.
   */
  readonly probeBuilder?: Maybe<MailgunNotificationHealthCheckProbeBuilder>;
  /**
   * The maximum number of recent events to inspect per address.
   */
  readonly recentEventsLimit?: Maybe<number>;
  /**
   * How far back to look for recent events, in days.
   */
  readonly recentEventsWindowDays?: Maybe<number>;
  /**
   * Whether to run Mailgun address validation as part of the check.
   *
   * Off by default, because validation consumes a separate Mailgun quota.
   */
  readonly validateAddress?: Maybe<boolean>;
  /**
   * How long a dispatched probe may stay unresolved before it is reported as failed.
   *
   * Defaults to {@link DEFAULT_MAILGUN_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES}.
   */
  readonly probeTimeoutMinutes?: Maybe<Minutes>;
}

/**
 * Creates a {@link NotificationEmailSendServiceHealthCheckService} backed by the Mailgun API.
 *
 * Attach the result to a {@link NotificationEmailSendService} as its `healthCheckService` and the
 * notification health check will pick it up automatically.
 *
 * @param config - The Mailgun service plus optional probe builder and inspection limits.
 * @returns A health check service for the email delivery method.
 *
 * @example
 * ```ts
 * const emailSendService = mailgunNotificationEmailSendService({ mailgunService, messageBuilders });
 *
 * const sendServiceWithHealthCheck: NotificationEmailSendService = {
 *   ...emailSendService,
 *   healthCheckService: mailgunNotificationEmailSendServiceHealthCheckService({
 *     mailgunService,
 *     probeBuilder: ({ recipient }) => ({
 *       to: recipient,
 *       template: 'notificationtemplate',
 *       subject: 'Email delivery test'
 *     })
 *   })
 * };
 * ```
 */
export function mailgunNotificationEmailSendServiceHealthCheckService(config: MailgunNotificationEmailSendServiceHealthCheckServiceConfig): NotificationEmailSendServiceHealthCheckService {
  const { mailgunService, probeBuilder, recentEventsLimit, recentEventsWindowDays, validateAddress, probeTimeoutMinutes: inputProbeTimeoutMinutes } = config;
  const probeTimeoutMinutes = inputProbeTimeoutMinutes ?? DEFAULT_MAILGUN_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES;
  const mailgunApi = mailgunService.mailgunApi;

  return {
    supportsProbe: probeBuilder != null,
    async runHealthCheck(request: NotificationSendServiceHealthCheckRequest<EmailAddress>): Promise<NotificationSendServiceHealthCheckResponse> {
      const { target, uid, sendProbe, pendingProbe, now } = request;

      const begin = recentEventsWindowDays == null ? undefined : new Date(now.getTime() - recentEventsWindowDays * 24 * 60 * 60 * 1000);

      const [domainState, suppressions, recentEvents, validation] = await Promise.all([
        //
        mailgunDomainState(mailgunApi),
        mailgunSuppressionsForRecipient(mailgunApi, target),
        mailgunRecentEventsForRecipient(mailgunApi, target, { limit: recentEventsLimit, begin }),
        validateAddress ? mailgunValidateEmail(mailgunApi, target) : Promise.resolve(undefined)
      ]);

      const issues: NotificationHealthCheckIssue[] = [];

      // MARK: domain
      if (domainState.unknown) {
        issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE, NotificationHealthCheckStatus.UNKNOWN, { message: 'The email provider could not be reached to confirm the sending domain is healthy.', data: { domain: domainState.domain } }));
      } else if (domainState.disabled || (domainState.state != null && domainState.state !== 'active')) {
        issues.push(
          notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.DOMAIN_NOT_ACTIVE, NotificationHealthCheckStatus.ERROR, {
            message: 'The system that sends our email is not currently active, so no email is going out to anyone.',
            fix: 'This is a system-wide problem. Contact support so it can be escalated.',
            data: { domain: domainState.domain, state: domainState.state, disabled: domainState.disabled }
          })
        );
      }

      // MARK: suppressions
      const { bounce, complaint, unsubscribe } = suppressions;

      if (bounce) {
        issues.push(
          notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.SUPPRESSED_BOUNCE, NotificationHealthCheckStatus.ERROR, {
            message: 'Email to this address previously bounced, so our email provider is now blocking every message to it.',
            fix: 'Contact support to have the block removed. If the address has a typo, correct it on your account first.',
            data: { address: bounce.address, code: bounce.code, error: bounce.error, createdAt: bounce.created_at }
          })
        );
      }

      if (complaint) {
        issues.push(
          notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.SUPPRESSED_COMPLAINT, NotificationHealthCheckStatus.ERROR, {
            message: 'One of our emails was reported as spam from this address, so our email provider is now blocking every message to it.',
            fix: 'Contact support to have the block removed.',
            data: { address: complaint.address, createdAt: complaint.created_at }
          })
        );
      }

      if (unsubscribe) {
        issues.push(
          notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.SUPPRESSED_UNSUBSCRIBE, NotificationHealthCheckStatus.WARNING, {
            message: 'This address has unsubscribed from our email, so most messages will not be delivered to it.',
            fix: 'Contact support to resubscribe this address.',
            data: { address: unsubscribe.address, tags: unsubscribe.tags, createdAt: unsubscribe.created_at }
          })
        );
      }

      // MARK: recent activity
      issues.push(...recentEventActivityIssues(recentEvents));

      // MARK: validation
      if (validation) {
        if (validation.result === 'undeliverable') {
          issues.push(
            notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.ADDRESS_UNDELIVERABLE, NotificationHealthCheckStatus.ERROR, {
              message: 'This address does not appear to be able to receive email.',
              fix: 'Check the address for typos and correct it on your account.',
              data: { address: validation.address, result: validation.result, risk: validation.risk, reason: validation.reason }
            })
          );
        }

        if (validation.is_disposable_address) {
          issues.push(
            notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.ADDRESS_DISPOSABLE, NotificationHealthCheckStatus.WARNING, {
              message: 'This address belongs to a disposable email service, which often stops accepting mail after a short time.',
              fix: 'Use a permanent email address for notifications.',
              data: { address: validation.address }
            })
          );
        }
      }

      // MARK: probe
      const probeResult = await resolveProbe({
        mailgunService,
        probeBuilder,
        probeTimeoutMinutes,
        target,
        uid,
        sendProbe,
        pendingProbe,
        now
      });

      issues.push(...probeResult.issues);

      return { issues, probe: probeResult.probe };
    }
  };
}

/**
 * Mailgun event names that settle a message's fate. Anything else (`accepted`, `opened`, …) leaves the
 * outcome still open.
 */
const CONCLUSIVE_MAILGUN_EVENT_NAMES: ReadonlySet<string> = new Set<string>([MailgunEventName.DELIVERED, MailgunEventName.FAILED, MailgunEventName.REJECTED]);

/**
 * Formats a failure reason as a sentence suffix.
 *
 * @param reason - The provider's explanation, when it recorded one.
 * @returns `: <reason>` when a reason is available, otherwise a full stop.
 */
function failureReasonSuffix(reason: Maybe<string>): string {
  return reason ? `: ${reason}` : '.';
}

/**
 * Classifies a recipient's recent Mailgun events into findings.
 *
 * The most recent conclusive event is what matters: a delivery after a failure means the problem is
 * already resolved, so an old failure should not be reported as a current one.
 *
 * @param recentEvents - The recipient's recent events, newest first.
 * @returns The findings describing the recipient's recent email activity.
 */
function recentEventActivityIssues(recentEvents: MailgunDomainEvent[]): NotificationHealthCheckIssue[] {
  if (!recentEvents.length) {
    return [
      notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY, NotificationHealthCheckStatus.WARNING, {
        message: 'No email has been sent to this address recently, so the problem is more likely to be in what triggers the notifications than in the email itself.',
        fix: 'Check the settings above, and contact support if you expected to receive something.'
      })
    ];
  }

  // events come back newest-first
  const conclusiveEvent = recentEvents.find((x) => CONCLUSIVE_MAILGUN_EVENT_NAMES.has(x.event));

  if (!conclusiveEvent) {
    return [notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY, NotificationHealthCheckStatus.UNKNOWN, { message: 'Recent email to this address has been accepted for delivery, but no delivery outcome has been recorded yet.', data: { eventCount: recentEvents.length } })];
  }

  const eventDate = mailgunDomainEventDate(conclusiveEvent);

  if (conclusiveEvent.event === MailgunEventName.DELIVERED) {
    return [
      notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS, NotificationHealthCheckStatus.OK, {
        message: 'Our email provider successfully delivered email to this address recently.',
        fix: 'If you still cannot find it, check your spam or junk folder and any email filters or rules you have set up.',
        data: { deliveredAt: eventDate }
      })
    ];
  }

  const reason = mailgunDomainEventFailureReason(conclusiveEvent);
  const isPermanent = conclusiveEvent.severity === MailgunEventSeverity.PERMANENT;

  return [
    notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE, isPermanent ? NotificationHealthCheckStatus.ERROR : NotificationHealthCheckStatus.WARNING, {
      message: `The last email we sent to this address did not get through${failureReasonSuffix(reason)}`,
      fix: isPermanent ? 'This will not resolve on its own. Check the address for typos, then contact support.' : 'This is often temporary. Re-run this check later to see if it clears.',
      data: { event: conclusiveEvent.event, severity: conclusiveEvent.severity, reason, at: eventDate }
    })
  ];
}

interface ResolveProbeInput {
  readonly mailgunService: MailgunService;
  readonly probeBuilder: Maybe<MailgunNotificationHealthCheckProbeBuilder>;
  readonly probeTimeoutMinutes: Minutes;
  readonly target: EmailAddress;
  readonly uid: FirebaseAuthUserId;
  readonly sendProbe: boolean;
  readonly pendingProbe: Maybe<NotificationHealthCheckProbe>;
  readonly now: Date;
}

interface ResolveProbeResult {
  readonly issues: NotificationHealthCheckIssue[];
  readonly probe?: Maybe<NotificationHealthCheckProbe>;
}

/**
 * Resolves an in-flight probe, or dispatches a new one.
 *
 * Resolving takes priority over dispatching: if a probe is already in flight there is no reason to send
 * a second message to the same inbox.
 *
 * @param input - The probe target, whether dispatching is permitted, and any probe already in flight.
 * @returns The probe findings and the resulting probe state.
 */
async function resolveProbe(input: ResolveProbeInput): Promise<ResolveProbeResult> {
  const { sendProbe, pendingProbe } = input;
  let result: ResolveProbeResult;

  if (pendingProbe) {
    result = await resolvePendingProbe(input, pendingProbe);
  } else if (sendProbe) {
    result = await dispatchProbe(input);
  } else {
    result = { issues: [] };
  }

  return result;
}

/**
 * Looks up the outcome of a probe that was dispatched by an earlier run.
 *
 * An empty event list means Mailgun has not recorded an outcome *yet*, not that the message failed —
 * only once the probe has outlived its timeout is silence treated as a failure.
 *
 * @param input - The probe target and timeout.
 * @param pendingProbe - The probe awaiting an outcome.
 * @returns The probe findings and the probe's updated state.
 */
async function resolvePendingProbe(input: ResolveProbeInput, pendingProbe: NotificationHealthCheckProbe): Promise<ResolveProbeResult> {
  const { mailgunService, probeTimeoutMinutes, target, now } = input;
  const events = await mailgunEventsForMessageId(mailgunService.mailgunApi, pendingProbe.id, { recipient: target });

  const delivered = events.find((x) => x.event === MailgunEventName.DELIVERED);
  const failure = events.find((x) => x.event === MailgunEventName.FAILED || x.event === MailgunEventName.REJECTED);
  const probeAgeMinutes = (now.getTime() - pendingProbe.at.getTime()) / (60 * 1000);

  let result: ResolveProbeResult;

  if (delivered) {
    result = {
      issues: [
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_DELIVERED, NotificationHealthCheckStatus.OK, {
          message: 'The test email we sent was delivered successfully.',
          fix: 'If it is not in your inbox, check your spam or junk folder and any email filters you have set up.',
          data: { deliveredAt: mailgunDomainEventDate(delivered) }
        })
      ],
      probe: { ...pendingProbe, s: NotificationHealthCheckStatus.OK, d: 'Delivered' }
    };
  } else if (failure) {
    const reason = mailgunDomainEventFailureReason(failure);

    result = {
      issues: [
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_FAILED, NotificationHealthCheckStatus.ERROR, {
          message: `The test email we sent did not get through${failureReasonSuffix(reason)}`,
          fix: 'Check the address for typos, then contact support with this report.',
          data: { event: failure.event, severity: failure.severity, reason }
        })
      ],
      probe: { ...pendingProbe, s: NotificationHealthCheckStatus.ERROR, d: reason ?? 'Delivery failed' }
    };
  } else if (probeAgeMinutes > probeTimeoutMinutes) {
    result = {
      issues: [
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_FAILED, NotificationHealthCheckStatus.ERROR, {
          message: 'The test email we sent never reached a delivery result, which means it did not arrive.',
          fix: 'Contact support with this report.',
          data: { dispatchedAt: pendingProbe.at, probeTimeoutMinutes }
        })
      ],
      probe: { ...pendingProbe, s: NotificationHealthCheckStatus.ERROR, d: 'No delivery result recorded' }
    };
  } else {
    result = {
      issues: [
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_PENDING, NotificationHealthCheckStatus.PENDING, {
          message: 'We sent a test email and are still waiting to hear whether it arrived.',
          fix: 'Nothing to do — the result appears here on its own as soon as our email provider reports it.',
          data: { dispatchedAt: pendingProbe.at }
        })
      ],
      probe: pendingProbe
    };
  }

  return result;
}

/**
 * Records a dispatch attempt that produced nothing to track it by.
 *
 * A probe is recorded all the same, with no correlation id and a status that is already settled. That
 * matters beyond the report: the test message window is derived from the recorded probe's `at`, so an
 * attempt that recorded nothing would leave both the server's throttle and the client's countdown with
 * nothing to key on — the action would come back looking successful and be immediately repeatable, one
 * provider call per click. An attempt is an attempt whether or not it can be followed up.
 *
 * The provider's own status distinguishes the two very different cases: a send it accepted but did not
 * give an id for (typical of an environment with sending suppressed, where the address is probably fine
 * and simply unverifiable), and a send it refused outright (a real failure, reported as one).
 *
 * @param sendResult - What the provider returned for the send.
 * @param input - The probe target and dispatch time.
 * @returns The finding describing the attempt, and the settled probe recording it.
 */
function dispatchWithoutMessageIdResult(sendResult: MailgunEmailMessageSendResult, input: Pick<ResolveProbeInput, 'target' | 'now'>): ResolveProbeResult {
  const { target, now } = input;
  const { status, message } = sendResult;
  const accepted = status != null && status >= 200 && status < 300;
  const data = { status, message };
  const probeStatus = accepted ? NotificationHealthCheckStatus.UNKNOWN : NotificationHealthCheckStatus.ERROR;

  return {
    issues: accepted
      ? [
          notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED, NotificationHealthCheckStatus.UNKNOWN, {
            message: 'Our email provider accepted the test email but did not give us a way to track it, so we cannot confirm whether it arrives.',
            fix: 'Check your inbox — and your spam or junk folder — for a test email sent just now.',
            data
          })
        ]
      : [notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED, NotificationHealthCheckStatus.ERROR, { message: `Our email provider refused to send the test email${failureReasonSuffix(message)}`, fix: 'Contact support with this report.', data })],
    probe: untrackableNotificationHealthCheckProbe({ at: now, s: probeStatus, tg: target, d: accepted ? 'Sent, but not trackable' : (message ?? 'Refused by the email provider') })
  };
}

/**
 * Sends a new probe message and records it as pending.

/**
 * Sends a new probe message and records it as pending.
 *
 * @param input - The probe target and message builder.
 * @returns The probe findings and the newly dispatched probe, if one could be sent.
 */
async function dispatchProbe(input: ResolveProbeInput): Promise<ResolveProbeResult> {
  const { mailgunService, probeBuilder, target, uid, now } = input;

  if (!probeBuilder) {
    return {
      issues: [notificationHealthCheckIssue(MailgunNotificationHealthCheckIssueCode.PROBE_NOT_CONFIGURED, NotificationHealthCheckStatus.SKIPPED, { message: 'Sending a test email is not available on this system.', data: { target } })]
    };
  }

  const recipient: MailgunRecipient = { email: target };
  let result: ResolveProbeResult;

  try {
    const request = await probeBuilder({ mailgunService, recipient, uid });
    const sendResult = await mailgunService.sendTemplateEmail(request);
    const messageId = sendResult.id;

    result = messageId
      ? {
          issues: [
            notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_PENDING, NotificationHealthCheckStatus.PENDING, {
              message: 'We just sent a test email to this address, and our email provider accepted it for delivery.',
              fix: 'Nothing to do — the result appears here on its own as soon as our email provider reports it.',
              data: { dispatchedAt: now, status: sendResult.status }
            })
          ],
          probe: {
            id: bareMailgunMessageId(messageId),
            at: now,
            s: NotificationHealthCheckStatus.PENDING,
            tg: target
          }
        }
      : dispatchWithoutMessageIdResult(sendResult, input);
  } catch (e) {
    // recorded like any other attempt, so the window applies — a provider that is throwing is the last
    // one that should be called again on the user's next click
    result = {
      issues: [
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED, NotificationHealthCheckStatus.ERROR, {
          message: 'The test email could not be sent at all, which points to a problem with our email system rather than your address.',
          fix: 'Contact support with this report.',
          data: { error: `${e}` }
        })
      ],
      probe: untrackableNotificationHealthCheckProbe({ at: now, s: NotificationHealthCheckStatus.ERROR, tg: target, d: 'Could not be sent' })
    };
  }

  return result;
}
