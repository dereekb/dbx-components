/**
 * @module notification.healthcheck.service
 *
 * The extension point that lets each delivery method contribute its own diagnostics to a
 * notification delivery health check.
 *
 * The shared health check action can only inspect what it knows about: the user's configuration,
 * their notification boxes, and the send queue. Everything beyond that is provider-specific — whether
 * an address is on an email provider's suppression list, whether a carrier rejected an SMS, whether a
 * test message actually arrived. A send service opts into contributing that knowledge by exposing a
 * {@link NotificationSendServiceHealthCheckService}.
 */
import { type EmailAddress, type E164PhoneNumber, type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId, type NotificationDeliveryMethod, type NotificationHealthCheckIssue, type NotificationHealthCheckIssueAutofixResult, type NotificationHealthCheckIssueCode, type NotificationHealthCheckProbe, type NotificationSummaryId, type NotificationTemplateType } from '@dereekb/firebase';

/**
 * Input to a {@link NotificationSendServiceHealthCheckService}.
 *
 * @template T - The delivery target type for the method (email address, phone number, summary id).
 */
export interface NotificationSendServiceHealthCheckRequest<T = unknown> {
  /**
   * The delivery method being diagnosed.
   */
  readonly method: NotificationDeliveryMethod;
  /**
   * The resolved delivery target to diagnose.
   */
  readonly target: T;
  /**
   * The user the check is being run for.
   */
  readonly uid: FirebaseAuthUserId;
  /**
   * Whether this run is permitted to dispatch a real probe message to the target.
   *
   * Always respect this — a probe sends real mail or SMS to a real person, and the caller has decided
   * whether that is acceptable right now.
   */
  readonly sendProbe: boolean;
  /**
   * A probe dispatched by an earlier run that has not reached a final status yet.
   *
   * When present, the service should try to resolve it and return it (updated) as the response's probe.
   */
  readonly pendingProbe?: Maybe<NotificationHealthCheckProbe>;
  /**
   * The notification template type the check is being evaluated against, if the caller specified one.
   */
  readonly notificationTemplateType?: Maybe<NotificationTemplateType>;
  /**
   * The time the health check started. Use this rather than reading the clock so every finding in a
   * single check shares one reference time.
   */
  readonly now: Date;
}

/**
 * Output of a {@link NotificationSendServiceHealthCheckService}.
 */
export interface NotificationSendServiceHealthCheckResponse {
  /**
   * Provider-level findings. May be empty when the provider had nothing to report.
   */
  readonly issues: NotificationHealthCheckIssue[];
  /**
   * The probe for this delivery method — a newly dispatched one, a resolved pending one, or a pending
   * one that still has no outcome.
   */
  readonly probe?: Maybe<NotificationHealthCheckProbe>;
}

/**
 * Input to {@link NotificationSendServiceHealthCheckService.runAutofix}.
 *
 * @template T - The delivery target type for the method (email address, phone number, summary id).
 */
export interface NotificationSendServiceHealthCheckAutofixRequest<T = unknown> {
  /**
   * The delivery method being fixed.
   */
  readonly method: NotificationDeliveryMethod;
  /**
   * The delivery target to fix, as recorded by the health check that reported the issues.
   */
  readonly target: T;
  /**
   * The user the fix is being applied for.
   */
  readonly uid: FirebaseAuthUserId;
  /**
   * The codes of the issues to fix.
   *
   * Every code was reported by this service on the stored health check and marked fixable, and any
   * {@link NotificationHealthCheckIssueAutofixType.EXPLICIT} fix among them has been explicitly allowed.
   * The service only has to apply them.
   */
  readonly codes: NotificationHealthCheckIssueCode[];
  /**
   * The time the fix started.
   */
  readonly now: Date;
}

/**
 * Output of {@link NotificationSendServiceHealthCheckService.runAutofix}.
 */
export interface NotificationSendServiceHealthCheckAutofixResponse {
  /**
   * The outcome of each requested fix, one per requested code.
   */
  readonly results: NotificationHealthCheckIssueAutofixResult[];
}

/**
 * Contributes provider-specific diagnostics for one delivery method.
 *
 * Implementations should be failure-tolerant: if a provider API is unreachable, report that as an
 * {@link NotificationHealthCheckStatus.UNKNOWN} issue rather than throwing, so the rest of the health
 * check still reaches the user.
 *
 * A service that can repair some of what it reports also implements {@link runAutofix}, and marks each
 * issue it can repair with an `autofix` type so a caller knows what it may ask to have fixed.
 *
 * @template T - The delivery target type for the method.
 *
 * @example
 * ```ts
 * const healthCheckService: NotificationEmailSendServiceHealthCheckService = {
 *   supportsProbe: true,
 *   async runHealthCheck({ target, sendProbe }) {
 *     const issues = await inspectSuppressionLists(target);
 *     const probe = sendProbe ? await dispatchProbe(target) : undefined;
 *     return { issues, probe };
 *   }
 * };
 * ```
 */
export interface NotificationSendServiceHealthCheckService<T = unknown> {
  /**
   * Whether this service can dispatch a probe message.
   *
   * Reported to callers so a UI can hide the "send a test message" affordance for methods that do not
   * support it. Defaults to false.
   */
  readonly supportsProbe?: Maybe<boolean>;
  /**
   * Runs the provider's diagnostics for a single delivery target.
   *
   * @param request - The target to diagnose and whether probing is permitted.
   * @returns The provider's findings and probe state.
   */
  runHealthCheck(request: NotificationSendServiceHealthCheckRequest<T>): Promise<NotificationSendServiceHealthCheckResponse>;
  /**
   * Optional. Fixes issues this service reported as fixable.
   *
   * Like {@link runHealthCheck}, it should be failure-tolerant: a fix that could not be applied is
   * reported as an unfixed result rather than thrown, so the other fixes in the request still go through.
   *
   * @param request - The target and the issue codes to fix.
   * @returns The outcome of each fix.
   */
  runAutofix?(request: NotificationSendServiceHealthCheckAutofixRequest<T>): Promise<NotificationSendServiceHealthCheckAutofixResponse>;
}

/**
 * A {@link NotificationSendServiceHealthCheckService} for the email delivery method.
 */
export type NotificationEmailSendServiceHealthCheckService = NotificationSendServiceHealthCheckService<EmailAddress>;

/**
 * A {@link NotificationSendServiceHealthCheckService} for the text/SMS delivery method.
 */
export type NotificationTextSendServiceHealthCheckService = NotificationSendServiceHealthCheckService<E164PhoneNumber>;

/**
 * A {@link NotificationSendServiceHealthCheckService} for the in-app notification summary delivery method.
 */
export type NotificationSummarySendServiceHealthCheckService = NotificationSendServiceHealthCheckService<NotificationSummaryId>;
