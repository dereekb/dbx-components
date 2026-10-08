/**
 * @module notification.healthcheck.twilio
 *
 * Twilio-backed diagnostics for the text message delivery method.
 *
 * This is where "the user says they aren't getting texts" turns into an actual answer. In practice the
 * cause is almost always one of:
 *
 * - the number **replied STOP** to one of our texts, after which Twilio refuses every text to it until it
 *   replies START
 * - recent texts to the number **failed or were not delivered**, with an error Twilio recorded, such as a
 *   landline, a number no longer in service, or a carrier spam filter
 * - nothing was ever texted to the number at all, which points upstream at configuration
 * - the **account** is not active, or the sending number is not registered with US carriers, which blocks
 *   texts for everyone
 *
 * The account and recent texts are readable from Twilio without sending anything, and a number lookup can
 * be turned on as well. When that is not conclusive, an opt-in probe sends a real text and follows its
 * status. A STOP opt-out only shows when a send is refused, so the probe is also how one is found.
 * Resolution is asynchronous, since carriers report delivery seconds after the send, so the probe is
 * recorded as pending and settled by a later verification, which the client polls for automatically.
 */
import { type E164PhoneNumber, type Maybe, type Minutes, type PromiseOrValue, filterUndefinedValues } from '@dereekb/util';
import {
  type FirebaseAuthUserId,
  type NotificationHealthCheckIssue,
  type NotificationHealthCheckIssueData,
  type NotificationHealthCheckProbe,
  KnownNotificationHealthCheckIssueCode,
  NotificationHealthCheckStatus,
  TwilioNotificationHealthCheckIssueCode,
  notificationHealthCheckIssue,
  untrackableNotificationHealthCheckProbe
} from '@dereekb/firebase';
import { type NotificationSendServiceHealthCheckRequest, type NotificationSendServiceHealthCheckResponse, type NotificationTextSendServiceHealthCheckService } from '@dereekb/firebase-server/model';
import {
  type TwilioApi,
  type TwilioDiagnosticError,
  type TwilioDiagnosticMessage,
  type TwilioMessageStatus,
  type TwilioPhoneNumberDiagnosis,
  type TwilioRecentMessagesForRecipientResult,
  type TwilioSendSmsInput,
  type TwilioService,
  DEFAULT_TWILIO_RECENT_MESSAGES_WINDOW_DAYS,
  TwilioMessageErrorCode,
  isTwilioDiagnosticPermissionError,
  twilioAccountState,
  twilioDiagnosticMessageDate,
  twilioLookupPhoneNumberForDiagnosis,
  twilioMessageForSid,
  twilioRecentMessagesForRecipient
} from '@dereekb/nestjs/twilio';

/**
 * How long a dispatched probe may stay unresolved before it is settled without a delivery report.
 *
 * Carriers normally report delivery within seconds; a probe with no outcome after this long is not going to get one.
 */
export const DEFAULT_TWILIO_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES = 15;

// The codes this check emits live in @dereekb/firebase as TwilioNotificationHealthCheckIssueCode, so a
// browser can ship a presentation for each one. Import them from there rather than from here.

/**
 * Input for building the test text dispatched as a delivery probe.
 */
export interface TwilioNotificationHealthCheckProbeBuilderInput {
  /**
   * The Twilio service, for reading the configured sender.
   */
  readonly twilioService: TwilioService;
  /**
   * The number to send the probe to.
   */
  readonly to: E164PhoneNumber;
  /**
   * The user the health check is running for.
   */
  readonly uid: FirebaseAuthUserId;
}

/**
 * Builds the test text dispatched as a delivery probe. The text is always sent to the probed number, whatever `to` the builder sets.
 *
 * The message should be recognizable to whoever receives it — it lands on a real phone, unannounced,
 * because someone asked the system to check whether their texts work. Carriers also expect it to name the sender.
 */
export type TwilioNotificationHealthCheckProbeBuilder = (input: TwilioNotificationHealthCheckProbeBuilderInput) => PromiseOrValue<TwilioSendSmsInput>;

/**
 * Configuration for {@link twilioNotificationTextSendServiceHealthCheckService}.
 */
export interface TwilioNotificationTextSendServiceHealthCheckServiceConfig {
  /**
   * The Twilio service to diagnose against and send probes through.
   */
  readonly twilioService: TwilioService;
  /**
   * Builds the probe message. Probing is unavailable when this is not provided.
   */
  readonly probeBuilder?: Maybe<TwilioNotificationHealthCheckProbeBuilder>;
  /**
   * The maximum number of recent texts to inspect per number.
   */
  readonly recentMessagesLimit?: Maybe<number>;
  /**
   * How far back to look for recent texts, in days.
   *
   * Defaults to {@link DEFAULT_TWILIO_RECENT_MESSAGES_WINDOW_DAYS}.
   */
  readonly recentMessagesWindowDays?: Maybe<number>;
  /**
   * Whether to look the number up with Twilio Lookup as part of the check, to find an invalid number or a landline.
   *
   * Off by default, because Twilio charges per lookup for the line type.
   */
  readonly lookupNumber?: Maybe<boolean>;
  /**
   * How long a dispatched probe may stay unresolved before it is settled without a delivery report.
   *
   * Defaults to {@link DEFAULT_TWILIO_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES}.
   */
  readonly probeTimeoutMinutes?: Maybe<Minutes>;
}

/**
 * Creates a {@link NotificationTextSendServiceHealthCheckService} backed by the Twilio API.
 *
 * Pass the result to {@link twilioNotificationTextSendService} as its `healthCheckService` and the
 * notification health check will pick it up automatically.
 *
 * @param config - The Twilio service plus optional probe builder and inspection limits.
 * @returns A health check service for the text delivery method.
 *
 * @example
 * ```ts
 * const textSendService = twilioNotificationTextSendService({
 *   twilioService,
 *   healthCheckService: twilioNotificationTextSendServiceHealthCheckService({
 *     twilioService,
 *     probeBuilder: ({ to }) => ({ to, body: 'Example App: this is a test text confirming we can text this number. No reply is needed.' })
 *   })
 * });
 * ```
 */
export function twilioNotificationTextSendServiceHealthCheckService(config: TwilioNotificationTextSendServiceHealthCheckServiceConfig): NotificationTextSendServiceHealthCheckService {
  const { twilioService, probeBuilder, recentMessagesLimit, recentMessagesWindowDays: inputRecentMessagesWindowDays, lookupNumber, probeTimeoutMinutes: inputProbeTimeoutMinutes } = config;
  const recentMessagesWindowDays = inputRecentMessagesWindowDays ?? DEFAULT_TWILIO_RECENT_MESSAGES_WINDOW_DAYS;
  const probeTimeoutMinutes = inputProbeTimeoutMinutes ?? DEFAULT_TWILIO_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES;

  return {
    supportsProbe: probeBuilder != null,
    async runHealthCheck(request: NotificationSendServiceHealthCheckRequest<E164PhoneNumber>): Promise<NotificationSendServiceHealthCheckResponse> {
      const { target, uid, sendProbe, pendingProbe, now } = request;
      const twilioApi = twilioService.twilioApi;
      const dateSentAfter = new Date(now.getTime() - recentMessagesWindowDays * 24 * 60 * 60 * 1000);

      const [accountState, recentMessages, numberDiagnosis] = await Promise.all([
        //
        twilioAccountState(twilioApi),
        twilioRecentMessagesForRecipient(twilioApi, target, { limit: recentMessagesLimit, dateSentAfter }),
        lookupNumber ? twilioLookupPhoneNumberForDiagnosis(twilioApi, target, true) : Promise.resolve(undefined)
      ]);

      const issues: NotificationHealthCheckIssue[] = [];

      // MARK: account
      // Twilio does not let a Standard API key read the account, which says nothing about sending when the other reads work
      const providerUnreadable = accountState.unknown === true && recentMessages.unknown === true;

      if (providerUnreadable) {
        const credentialsRefused = isTwilioDiagnosticPermissionError(accountState.error) && isTwilioDiagnosticPermissionError(recentMessages.error);

        issues.push(
          notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE, NotificationHealthCheckStatus.UNKNOWN, {
            message: credentialsRefused ? 'Our text provider refused our credentials, so text delivery could not be checked.' : 'Our text provider could not be reached, so text delivery could not be checked.',
            fix: credentialsRefused ? 'This is a system-wide problem. Contact support so it can be escalated.' : 'Try again in a few minutes. If this keeps happening, the text provider may be having an outage.',
            data: twilioDiagnosticErrorData(recentMessages.error)
          })
        );
      } else if (accountState.unknown) {
        if (!isTwilioDiagnosticPermissionError(accountState.error)) {
          issues.push(
            notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE, NotificationHealthCheckStatus.UNKNOWN, { message: 'Our text provider could not be reached to confirm the account that sends our texts is active.', data: twilioDiagnosticErrorData(accountState.error) })
          );
        }
      } else if (accountState.status != null && accountState.status !== 'active') {
        issues.push(
          notificationHealthCheckIssue(TwilioNotificationHealthCheckIssueCode.ACCOUNT_NOT_ACTIVE, NotificationHealthCheckStatus.ERROR, {
            message: 'The account that sends our texts is not currently active, so no texts are going out to anyone.',
            fix: 'This is a system-wide problem. Contact support so it can be escalated.',
            data: { status: accountState.status }
          })
        );
      }

      // MARK: number
      issues.push(...numberDiagnosisIssues(numberDiagnosis, target));

      // MARK: recent activity
      // an unreadable provider is already reported above
      if (!providerUnreadable) {
        issues.push(...recentMessageActivityIssues(recentMessages));
      }

      // MARK: probe
      const probeResult = await resolveProbe({ twilioService, twilioApi, probeBuilder, probeTimeoutMinutes, target, uid, sendProbe, pendingProbe, now });
      issues.push(...probeResult.issues);

      return { issues, probe: probeResult.probe };
    }
  };
}

// MARK: Classification
/**
 * Statuses of a text that reached the phone.
 */
const DELIVERED_TWILIO_MESSAGE_STATUSES: ReadonlySet<TwilioMessageStatus> = new Set<TwilioMessageStatus>(['delivered', 'read']);

/**
 * Status of a text the carrier accepted. Some carriers never confirm delivery, so it can be the last status a delivered text gets.
 */
const SENT_TWILIO_MESSAGE_STATUS: TwilioMessageStatus = 'sent';

/**
 * Statuses of a text that did not reach the phone.
 */
const FAILED_TWILIO_MESSAGE_STATUSES: ReadonlySet<TwilioMessageStatus> = new Set<TwilioMessageStatus>(['failed', 'undelivered']);

/**
 * Plain-language reasons for the error codes that explain a failed text.
 */
const TWILIO_ERROR_CODE_REASONS: Readonly<Partial<Record<number, string>>> = {
  [TwilioMessageErrorCode.INVALID_TO_NUMBER]: 'the number is not a valid phone number',
  [TwilioMessageErrorCode.UNSUBSCRIBED_RECIPIENT]: 'this number replied STOP to opt out of our texts',
  [TwilioMessageErrorCode.NOT_A_MOBILE_NUMBER]: 'the number is not a mobile number, so it cannot receive texts',
  [TwilioMessageErrorCode.ACCOUNT_SUSPENDED]: 'the account that sends our texts is suspended',
  [TwilioMessageErrorCode.UNREACHABLE_DESTINATION_HANDSET]: 'the phone was switched off or out of coverage',
  [TwilioMessageErrorCode.MESSAGE_BLOCKED]: 'the carrier or the phone blocked it',
  [TwilioMessageErrorCode.UNKNOWN_DESTINATION_HANDSET]: 'the number does not exist or is no longer in service',
  [TwilioMessageErrorCode.LANDLINE_OR_UNREACHABLE_CARRIER]: 'the number is a landline, or its carrier cannot receive texts',
  [TwilioMessageErrorCode.MESSAGE_FILTERED]: 'the carrier filtered it, usually as suspected spam',
  [TwilioMessageErrorCode.UNREGISTERED_NUMBER]: 'our sending number is not registered with US carriers'
};

/**
 * Error codes of a failure that usually clears on its own.
 */
const TEMPORARY_TWILIO_ERROR_CODES: ReadonlySet<number> = new Set<number>([TwilioMessageErrorCode.QUEUE_OVERFLOW, TwilioMessageErrorCode.UNREACHABLE_DESTINATION_HANDSET, TwilioMessageErrorCode.UNKNOWN_ERROR]);

/**
 * Error codes that mean the number itself is wrong.
 */
const INVALID_NUMBER_TWILIO_ERROR_CODES: ReadonlySet<number> = new Set<number>([TwilioMessageErrorCode.INVALID_TO_NUMBER, TwilioMessageErrorCode.NOT_A_MOBILE_NUMBER]);

/**
 * Returns the plain-language reason a text failed.
 *
 * @param errorCode - Twilio's error code, if it recorded one.
 * @param errorMessage - Twilio's error message, if it recorded one.
 * @returns The reason, if one is known.
 */
function twilioFailureReason(errorCode: Maybe<number>, errorMessage: Maybe<string>): Maybe<string> {
  return (errorCode == null ? undefined : TWILIO_ERROR_CODE_REASONS[errorCode]) ?? (errorMessage || undefined) ?? (errorCode == null ? undefined : `error ${errorCode}`);
}

/**
 * Returns the issue data describing why a diagnostic read could not be made.
 *
 * @param error - The read's error, if it failed.
 * @returns The issue data, if there is an error.
 */
function twilioDiagnosticErrorData(error: Maybe<TwilioDiagnosticError>): Maybe<NotificationHealthCheckIssueData> {
  return error ? filterUndefinedValues({ error: error.message, status: error.status ?? undefined, code: error.code ?? undefined }) : undefined;
}

/**
 * Formats a failure reason as a sentence suffix.
 *
 * @param reason - The plain-language reason, when one is known.
 * @returns `: <reason>` when a reason is available, otherwise a full stop.
 */
function failureReasonSuffix(reason: Maybe<string>): string {
  return reason ? `: ${reason}.` : '.';
}

/**
 * Returns the finding for a failure whose error code points at a more specific cause than a failed text: a number that
 * replied STOP, or a sending number that US carriers block.
 *
 * @param errorCode - Twilio's error code, if it recorded one.
 * @param data - Data to attach to the finding.
 * @returns The finding, if the error code has a specific cause.
 */
function twilioErrorCodeCauseIssue(errorCode: Maybe<number>, data: Record<string, unknown>): Maybe<NotificationHealthCheckIssue> {
  let issue: Maybe<NotificationHealthCheckIssue>;

  if (errorCode === TwilioMessageErrorCode.UNSUBSCRIBED_RECIPIENT) {
    issue = notificationHealthCheckIssue(TwilioNotificationHealthCheckIssueCode.RECIPIENT_OPTED_OUT, NotificationHealthCheckStatus.ERROR, {
      message: 'This number replied STOP to one of our texts, so our text provider blocks every text to it.',
      fix: 'Reply START to any text from us to receive texts again.',
      data
    });
  } else if (errorCode === TwilioMessageErrorCode.UNREGISTERED_NUMBER) {
    issue = notificationHealthCheckIssue(TwilioNotificationHealthCheckIssueCode.SENDER_NOT_REGISTERED, NotificationHealthCheckStatus.ERROR, {
      message: 'Our sending number is not registered with US carriers, so they are blocking our texts to everyone.',
      fix: 'This is a system-wide problem. Contact support so it can be escalated.',
      data
    });
  }

  return issue;
}

/**
 * Classifies a number lookup into findings.
 *
 * @param diagnosis - The lookup, if one was made.
 * @param target - The number that was looked up.
 * @returns The findings about the number itself.
 */
function numberDiagnosisIssues(diagnosis: Maybe<TwilioPhoneNumberDiagnosis>, target: E164PhoneNumber): NotificationHealthCheckIssue[] {
  const issues: NotificationHealthCheckIssue[] = [];

  // a lookup that could not be made is optional extra detail, so it is not reported
  if (diagnosis?.valid === false) {
    issues.push(
      notificationHealthCheckIssue(TwilioNotificationHealthCheckIssueCode.NUMBER_INVALID, NotificationHealthCheckStatus.ERROR, {
        message: 'Our text provider says this is not a valid phone number.',
        fix: 'Check the number for typos and correct it in your notification settings.',
        data: { phoneNumber: target }
      })
    );
  } else if (diagnosis?.lineType === 'landline') {
    issues.push(
      notificationHealthCheckIssue(TwilioNotificationHealthCheckIssueCode.NUMBER_LANDLINE, NotificationHealthCheckStatus.ERROR, {
        message: 'This number is a landline, which cannot receive texts.',
        fix: 'Use a mobile number for texts in your notification settings.',
        data: filterUndefinedValues({ phoneNumber: target, lineType: diagnosis.lineType, carrierName: diagnosis.carrierName })
      })
    );
  }

  return issues;
}

/**
 * Classifies a number's recent texts into findings.
 *
 * The most recent conclusive text is what matters: a delivery after a failure means the problem is already
 * resolved, so an old failure should not be reported as a current one.
 *
 * @param recentMessages - The number's recent texts, newest first.
 * @returns The findings describing the number's recent text activity.
 */
function recentMessageActivityIssues(recentMessages: TwilioRecentMessagesForRecipientResult): NotificationHealthCheckIssue[] {
  const { messages, unknown } = recentMessages;
  let issues: NotificationHealthCheckIssue[];

  if (unknown) {
    issues = [notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE, NotificationHealthCheckStatus.UNKNOWN, { message: 'Our text provider could not be reached to read the recent texts to this number.', data: twilioDiagnosticErrorData(recentMessages.error) })];
  } else if (messages.length) {
    const conclusiveMessage = messages.find((x) => DELIVERED_TWILIO_MESSAGE_STATUSES.has(x.status) || FAILED_TWILIO_MESSAGE_STATUSES.has(x.status) || x.status === SENT_TWILIO_MESSAGE_STATUS);

    if (conclusiveMessage) {
      issues = [conclusiveMessageIssue(conclusiveMessage)];
    } else {
      issues = [notificationHealthCheckIssue(TwilioNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY, NotificationHealthCheckStatus.UNKNOWN, { message: 'Recent texts to this number were accepted for delivery, but no delivery outcome has been recorded yet.', data: { messageCount: messages.length } })];
    }
  } else {
    issues = [
      notificationHealthCheckIssue(TwilioNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY, NotificationHealthCheckStatus.WARNING, {
        message: 'No text has been sent to this number recently, so the problem is more likely to be in what triggers the notifications than in the texts themselves.',
        fix: 'Check the settings above, and contact support if you expected to receive something.'
      })
    ];
  }

  return issues;
}

/**
 * Describes the most recent conclusive text to a number.
 *
 * @param message - The text.
 * @returns The finding describing it.
 */
function conclusiveMessageIssue(message: TwilioDiagnosticMessage): NotificationHealthCheckIssue {
  const { status, errorCode, errorMessage } = message;
  const at = twilioDiagnosticMessageDate(message);
  let issue: NotificationHealthCheckIssue;

  if (DELIVERED_TWILIO_MESSAGE_STATUSES.has(status) || status === SENT_TWILIO_MESSAGE_STATUS) {
    issue = notificationHealthCheckIssue(TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS, NotificationHealthCheckStatus.OK, {
      message: status === SENT_TWILIO_MESSAGE_STATUS ? 'Our text provider recently handed a text for this number to its carrier, though the carrier did not confirm it was delivered.' : 'Our text provider successfully delivered a text to this number recently.',
      fix: 'If you still cannot find it, check whether your phone filters or blocks texts from unknown senders.',
      data: filterUndefinedValues({ status, at })
    });
  } else {
    const data = filterUndefinedValues({ status, errorCode, errorMessage, at });
    const reason = twilioFailureReason(errorCode, errorMessage);
    const isTemporary = errorCode != null && TEMPORARY_TWILIO_ERROR_CODES.has(errorCode);

    issue =
      twilioErrorCodeCauseIssue(errorCode, data) ??
      notificationHealthCheckIssue(TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE, isTemporary ? NotificationHealthCheckStatus.WARNING : NotificationHealthCheckStatus.ERROR, {
        message: `The last text we sent to this number did not get through${failureReasonSuffix(reason)}`,
        fix: isTemporary ? 'This is often temporary. Re-run this check later to see if it clears.' : 'This will not resolve on its own. Check the number for typos, then contact support.',
        data
      });
  }

  return issue;
}

// MARK: Probe
interface ResolveProbeInput {
  readonly twilioService: TwilioService;
  readonly twilioApi: TwilioApi;
  readonly probeBuilder: Maybe<TwilioNotificationHealthCheckProbeBuilder>;
  readonly probeTimeoutMinutes: Minutes;
  readonly target: E164PhoneNumber;
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
 * a second text to the same phone.
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
 * A text still in flight has not reached an outcome *yet*, so only once the probe has outlived its timeout is it settled
 * without one. A text the carrier accepted but never confirmed is settled as unconfirmed rather than failed, since some
 * carriers never confirm delivery. A probe whose status could not be read stays pending.
 *
 * @param input - The probe target and timeout.
 * @param pendingProbe - The probe awaiting an outcome.
 * @returns The probe findings and the probe's updated state.
 */
async function resolvePendingProbe(input: ResolveProbeInput, pendingProbe: NotificationHealthCheckProbe): Promise<ResolveProbeResult> {
  const { twilioApi, probeTimeoutMinutes, now } = input;
  const { message, unknown } = await twilioMessageForSid(twilioApi, pendingProbe.id);
  const probeAgeMinutes = (now.getTime() - pendingProbe.at.getTime()) / (60 * 1000);
  const status = message?.status;

  let result: ResolveProbeResult;

  if (status != null && DELIVERED_TWILIO_MESSAGE_STATUSES.has(status)) {
    result = {
      issues: [
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_DELIVERED, NotificationHealthCheckStatus.OK, {
          message: 'The test text we sent was delivered successfully.',
          fix: 'If it is not on your phone, check whether your phone filters or blocks texts from unknown senders.',
          data: filterUndefinedValues({ deliveredAt: message ? twilioDiagnosticMessageDate(message) : undefined })
        })
      ],
      probe: { ...pendingProbe, s: NotificationHealthCheckStatus.OK, d: 'Delivered' }
    };
  } else if (message && status != null && FAILED_TWILIO_MESSAGE_STATUSES.has(status)) {
    const { errorCode, errorMessage } = message;
    const data = filterUndefinedValues({ status, errorCode, errorMessage });
    const reason = twilioFailureReason(errorCode, errorMessage);
    const causeIssue = twilioErrorCodeCauseIssue(errorCode, data);

    result = {
      issues: [
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_FAILED, NotificationHealthCheckStatus.ERROR, {
          message: `The test text we sent did not get through${failureReasonSuffix(reason)}`,
          fix: 'Check the number for typos, then contact support with this report.',
          data
        }),
        ...(causeIssue ? [causeIssue] : [])
      ],
      probe: { ...pendingProbe, s: NotificationHealthCheckStatus.ERROR, d: reason ?? 'Not delivered' }
    };
  } else if (!unknown && probeAgeMinutes > probeTimeoutMinutes) {
    if (status === SENT_TWILIO_MESSAGE_STATUS) {
      result = {
        issues: [
          notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_DELIVERED, NotificationHealthCheckStatus.UNKNOWN, {
            message: 'The test text we sent reached your carrier, but the carrier never confirmed it was delivered.',
            fix: 'Check your phone for the test text. Some carriers do not confirm delivery.',
            data: filterUndefinedValues({ dispatchedAt: pendingProbe.at, probeTimeoutMinutes, status })
          })
        ],
        probe: { ...pendingProbe, s: NotificationHealthCheckStatus.UNKNOWN, d: 'Sent to the carrier, delivery not confirmed' }
      };
    } else {
      result = {
        issues: [
          notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_FAILED, NotificationHealthCheckStatus.ERROR, {
            message: 'The test text we sent never reached a delivery result, which means it did not arrive.',
            fix: 'Contact support with this report.',
            data: filterUndefinedValues({ dispatchedAt: pendingProbe.at, probeTimeoutMinutes, status })
          })
        ],
        probe: { ...pendingProbe, s: NotificationHealthCheckStatus.ERROR, d: 'No delivery result recorded' }
      };
    }
  } else {
    result = {
      issues: [
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_PENDING, NotificationHealthCheckStatus.PENDING, {
          message: 'We sent a test text and are still waiting to hear whether it arrived.',
          fix: 'Nothing to do — the result appears here on its own as soon as our text provider reports it.',
          data: filterUndefinedValues({ dispatchedAt: pendingProbe.at, status })
        })
      ],
      probe: pendingProbe
    };
  }

  return result;
}

/**
 * Sends a new probe text and records it as pending.
 *
 * A send that produced no message to follow is recorded all the same, already settled, so the test message
 * window still applies to it. See {@link untrackableNotificationHealthCheckProbe}.
 *
 * @param input - The probe target and message builder.
 * @returns The probe findings and the newly dispatched probe.
 */
async function dispatchProbe(input: ResolveProbeInput): Promise<ResolveProbeResult> {
  const { twilioService, probeBuilder, target, uid, now } = input;
  let result: ResolveProbeResult;

  if (probeBuilder) {
    try {
      const request = await probeBuilder({ twilioService, to: target, uid });
      const sendResult = await twilioService.sendSms({ ...request, to: target });
      const { sid, status, sandboxed, error, errorCode } = sendResult;

      if (sid) {
        result = {
          issues: [
            notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_PENDING, NotificationHealthCheckStatus.PENDING, {
              message: 'We just sent a test text to this number, and our text provider accepted it for delivery.',
              fix: 'Nothing to do — the result appears here on its own as soon as our text provider reports it.',
              data: { dispatchedAt: now, status }
            })
          ],
          probe: { id: sid, at: now, s: NotificationHealthCheckStatus.PENDING, tg: target }
        };
      } else if (sandboxed) {
        result = {
          issues: [
            notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED, NotificationHealthCheckStatus.UNKNOWN, {
              message: 'Texts are in test mode on this system, so the test text was not actually sent.',
              fix: 'Contact support if you expected this system to send real texts.',
              data: { sandboxed }
            })
          ],
          probe: untrackableNotificationHealthCheckProbe({ at: now, s: NotificationHealthCheckStatus.UNKNOWN, tg: target, d: 'Not sent, texts are in test mode' })
        };
      } else {
        const data = filterUndefinedValues({ status, errorCode, error });
        const reason = twilioFailureReason(errorCode, error);
        const causeIssue = twilioErrorCodeCauseIssue(errorCode, data);
        const isInvalidNumber = errorCode != null && INVALID_NUMBER_TWILIO_ERROR_CODES.has(errorCode);

        result = {
          issues: [
            notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED, NotificationHealthCheckStatus.ERROR, {
              message: `Our text provider refused to send the test text${failureReasonSuffix(reason)}`,
              fix: isInvalidNumber ? 'Check the number for typos and correct it in your notification settings.' : 'Contact support with this report.',
              data
            }),
            ...(causeIssue ? [causeIssue] : [])
          ],
          probe: untrackableNotificationHealthCheckProbe({ at: now, s: NotificationHealthCheckStatus.ERROR, tg: target, d: reason ?? 'Refused by the text provider' })
        };
      }
    } catch (e) {
      // recorded like any other attempt, so the window applies — a provider that is throwing is the last
      // one that should be called again on the user's next click
      result = {
        issues: [
          notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED, NotificationHealthCheckStatus.ERROR, {
            message: 'The test text could not be sent at all, which points to a problem with our text system rather than your number.',
            fix: 'Contact support with this report.',
            data: { error: `${e}` }
          })
        ],
        probe: untrackableNotificationHealthCheckProbe({ at: now, s: NotificationHealthCheckStatus.ERROR, tg: target, d: 'Could not be sent' })
      };
    }
  } else {
    result = { issues: [notificationHealthCheckIssue(TwilioNotificationHealthCheckIssueCode.PROBE_NOT_CONFIGURED, NotificationHealthCheckStatus.SKIPPED, { message: 'Sending a test text is not available on this system.', data: { target } })] };
  }

  return result;
}
