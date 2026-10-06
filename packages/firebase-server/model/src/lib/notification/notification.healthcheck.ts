/**
 * @module notification.healthcheck
 *
 * The `healthCheck` server action: a self-serve diagnosis of why a given user is or is not receiving
 * notifications on each delivery method.
 *
 * The check runs in three passes:
 *
 * 1. **Configuration** — mirrors the gates {@link expandNotificationRecipients} applies at send time,
 *    so a finding here corresponds to a real reason a message would be dropped.
 * 2. **Subscriptions** — inspects the user's {@link NotificationBox} documents to confirm they exist,
 *    are initialized, and carry a recipient entry matching the user's own configuration.
 * 3. **Provider** — delegates to each delivery method's optional
 *    {@link NotificationSendServiceHealthCheckService} for provider-specific diagnostics and for
 *    dispatching/resolving a delivery probe.
 *
 * The result is persisted to the user's `hc` field, because delivery confirmation is asynchronous: a
 * probe dispatched by one run is resolved by a later one. That later run is normally a
 * `verifyPendingProbesOnly` VERIFICATION rather than anything the user does — a cheap poll that consults
 * a provider only where a probe is actually in flight, answers to its own short window, and advances
 * `vat` instead of `at` so that watching a test message never consumes the user's run allowance. The
 * client reads the stored check live, so a resolved probe simply appears.
 */
import {
  type FirebaseAuthUserId,
  type NotificationBoxId,
  type NotificationBoxRecipient,
  NotificationBoxRecipientFlag,
  type NotificationDeliveryHealthCheckResult,
  NotificationDeliveryMethod,
  type NotificationHealthCheck,
  type NotificationHealthCheckIssue,
  type NotificationHealthCheckIssueAutofixResult,
  NotificationHealthCheckIssueAutofixType,
  type NotificationHealthCheckProbe,
  NotificationHealthCheckStatus,
  type NotificationTemplateType,
  type NotificationUser,
  type NotificationUserDocument,
  type NotificationUserHealthCheckAutofixParams,
  type NotificationUserHealthCheckAutofixResult,
  type NotificationUserHealthCheckParams,
  type NotificationUserHealthCheckResult,
  type NotificationUserNotificationBoxRecipientConfig,
  DEFAULT_NOTIFICATION_TEMPLATE_TYPE,
  KnownNotificationHealthCheckIssueCode,
  ALL_NOTIFICATION_DELIVERY_METHODS,
  isNotificationDeliveryMethodDisabled,
  NotificationDeliveryMethodDecisionSource,
  type NotificationExplicitOptInConfig,
  resolveNotificationDeliveryMethodDecisions,
  resolveNotificationUidRecipientDelivery,
  isPendingNotificationHealthCheckProbe,
  notificationDeliveryHealthCheckResultForMethod,
  notificationHealthCheckIssue,
  notificationUserHealthCheckAutofixParamsType,
  notificationUserHealthCheckNextProbeAt,
  notificationUserHealthCheckNextRunAt,
  notificationUserHealthCheckNextVerifyAt,
  notificationUserHealthCheckParamsType,
  rollupNotificationDeliveryHealthCheckResultStatus,
  rollupNotificationHealthCheckResultStatus
} from '@dereekb/firebase';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { type EmailAddress, type E164PhoneNumber, type Maybe, filterMaybeArrayValues, takeFront, unique } from '@dereekb/util';
import { isAfter } from 'date-fns';
import { type NotificationServerActionsContext } from './notification.action.server';
import { notificationUserHealthCheckAutofixNotAllowedError, notificationUserHealthCheckAutofixUnavailableError, notificationUserHealthCheckProbeThrottledError, notificationUserHealthCheckThrottledError, notificationUserHealthCheckVerifyThrottledError } from './notification.error';
import { type NotificationSendServiceHealthCheckService } from './notification.healthcheck.service';

/**
 * The maximum number of the user's notification boxes to inspect in a single health check.
 *
 * A user can be subscribed to an unbounded number of boxes; a health check is interactive, so it
 * samples rather than walking all of them.
 */
export const DEFAULT_MAX_NOTIFICATION_BOXES_TO_INSPECT_PER_HEALTH_CHECK = 10;

/**
 * Issue codes that describe a delivery probe rather than a configuration finding.
 *
 * A verify-only run refreshes these and carries every other finding forward unchanged.
 */
const PROBE_NOTIFICATION_HEALTH_CHECK_ISSUE_CODES: ReadonlySet<string> = new Set<string>([KnownNotificationHealthCheckIssueCode.PROBE_PENDING, KnownNotificationHealthCheckIssueCode.PROBE_DELIVERED, KnownNotificationHealthCheckIssueCode.PROBE_FAILED, KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED]);

/**
 * Per-delivery-method view of what the server has configured, used to decide what can be checked.
 */
interface NotificationDeliveryMethodContext<T = unknown> {
  readonly method: NotificationDeliveryMethod;
  /**
   * Human-readable name for the method, used in issue messages.
   */
  readonly label: string;
  /**
   * Whether the server has a send service configured for this method at all.
   */
  readonly sendServiceConfigured: boolean;
  /**
   * The method's provider diagnostics, if it exposes any.
   */
  readonly healthCheckService?: Maybe<NotificationSendServiceHealthCheckService<T>>;
  /**
   * The resolved delivery target, if one could be determined.
   */
  readonly target?: Maybe<T>;
}

/**
 * Factory for the `healthCheck` action on a {@link NotificationUser}.
 *
 * @param context - The notification server actions context.
 * @returns A transform-and-validate function that runs a delivery health check for a notification user.
 */
export function notificationUserHealthCheckFactory(context: NotificationServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, notificationBoxCollection, notificationSendService, authService, notificationUserHealthCheckConfig, appNotificationTemplateTypeInfoRecordService } = context;
  const probeThrottleMinutes = notificationUserHealthCheckConfig?.probeThrottleMinutes;
  const runThrottleMinutes = notificationUserHealthCheckConfig?.runThrottleMinutes;
  const verifyThrottleSeconds = notificationUserHealthCheckConfig?.verifyThrottleSeconds;

  return firebaseServerActionTransformFunctionFactory(notificationUserHealthCheckParamsType, async (params: NotificationUserHealthCheckParams) => {
    const { methods: inputMethods, sendProbe: inputSendProbe, verifyPendingProbesOnly: inputVerifyPendingProbesOnly, notificationTemplateType: inputNotificationTemplateType, skipSubscriptionChecks: inputSkipSubscriptionChecks, force: inputForce, returnFullHealthCheck: inputReturnFullHealthCheck } = params;

    const sendProbe = inputSendProbe === true;
    const verifyPendingProbesOnly = inputVerifyPendingProbesOnly === true;
    const skipSubscriptionChecks = inputSkipSubscriptionChecks === true || verifyPendingProbesOnly;
    // Privileged, and unverifiable from here: the action cannot see who is calling, so the API layer is
    // responsible for clearing this unless the caller is an admin. See NotificationUserHealthCheckParams.
    const force = inputForce === true;

    return async (notificationUserDocument: NotificationUserDocument): Promise<NotificationUserHealthCheckResult> => {
      const now = new Date();
      const notificationUser = await assertSnapshotData(notificationUserDocument);
      const { uid, hc: previousHealthCheck } = notificationUser;

      // Runs, test messages and verifications are throttled independently, because they cost different
      // things: a run reads provider state, a probe delivers a real message, and a verification only asks
      // a provider what became of a message already sent. None of them may consume another's allowance —
      // in particular, polling an in-flight test message must not push the user's next run out, which is
      // why a verify-only run answers to its own window and advances `vat` rather than `at` below.
      //
      // The probe window is scoped to the methods being probed, since each method has its own test
      // message action — a test email must not hold the test text message off.
      //
      // `force` skips every window, so an admin diagnosing someone else's delivery does not have to wait
      // out that user's own throttle.
      if (!force) {
        if (sendProbe) {
          const nextProbeAt = notificationUserHealthCheckNextProbeAt({ healthCheck: previousHealthCheck, methods: inputMethods, throttleMinutes: probeThrottleMinutes });

          if (nextProbeAt != null && isAfter(nextProbeAt, now)) {
            throw notificationUserHealthCheckProbeThrottledError(nextProbeAt);
          }
        } else if (verifyPendingProbesOnly) {
          const nextVerifyAt = notificationUserHealthCheckNextVerifyAt({ healthCheck: previousHealthCheck, throttleSeconds: verifyThrottleSeconds });

          if (nextVerifyAt != null && isAfter(nextVerifyAt, now)) {
            throw notificationUserHealthCheckVerifyThrottledError(nextVerifyAt);
          }
        } else {
          const nextRunAt = notificationUserHealthCheckNextRunAt({ healthCheck: previousHealthCheck, throttleMinutes: runThrottleMinutes });

          if (nextRunAt != null && isAfter(nextRunAt, now)) {
            throw notificationUserHealthCheckThrottledError(nextRunAt);
          }
        }
      }

      const notificationTemplateType = inputNotificationTemplateType || DEFAULT_NOTIFICATION_TEMPLATE_TYPE;
      const explicitOptIn: Maybe<NotificationExplicitOptInConfig> = appNotificationTemplateTypeInfoRecordService.appNotificationTemplateTypeInfoRecord[notificationTemplateType];
      const authDetails = await authService
        .userContext(uid)
        .loadDetails()
        .catch(() => undefined);

      const methodContexts = buildNotificationDeliveryMethodContexts({
        notificationUser,
        notificationSendService,
        authEmail: authDetails?.email as Maybe<EmailAddress>,
        authPhone: authDetails?.phoneNumber as Maybe<E164PhoneNumber>,
        uid
      });

      const requestedMethods = inputMethods?.length ? new Set(inputMethods) : undefined;
      const methodContextsToCheck = methodContexts.filter((x) => (requestedMethods ? requestedMethods.has(x.method) : true));

      // MARK: account-wide
      const subscriptions = skipSubscriptionChecks ? undefined : await inspectNotificationUserSubscriptions({ notificationUser, notificationBoxCollection, notificationTemplateType, explicitOptIn });
      const disabledMethodsByBox = subscriptions?.issuesByMethod ?? new Map<NotificationDeliveryMethod, NotificationHealthCheckIssue[]>();

      const accountIssues: NotificationHealthCheckIssue[] = verifyPendingProbesOnly
        ? [...(previousHealthCheck?.is ?? [])]
        : [
            //
            ...notificationUserAccountIssues({ notificationUser, accountDisabled: authDetails?.disabled === true, accountExists: authDetails != null }),
            ...(subscriptions?.sharedIssues ?? [])
          ];

      // MARK: per-method
      let probesDispatched = 0;
      let probesResolved = 0;

      const methodResults: NotificationDeliveryHealthCheckResult[] = await Promise.all(
        methodContextsToCheck.map(async (methodContext) => {
          const { method, target, label, sendServiceConfigured, healthCheckService } = methodContext;
          const previousMethodResult = previousHealthCheck?.m.find((x) => x.me === method);
          const previousProbe = previousMethodResult?.pr;
          const pendingProbe = isPendingNotificationHealthCheckProbe(previousProbe) ? previousProbe : undefined;

          // A verify-only run is a poll of an in-flight test message, so it consults a provider only
          // where there is actually a probe to ask about. With nothing pending it costs no provider
          // calls at all, which is what makes it cheap enough to be polled on a short window.
          const providerHasSomethingToReport = !verifyPendingProbesOnly || pendingProbe != null;

          // whether the provider will be consulted, and so whether fresh probe findings are coming
          const willConsultProvider = healthCheckService != null && target != null && providerHasSomethingToReport;

          // A verify-only run carries the previous findings forward. The stale probe findings are only
          // dropped when the provider is actually going to replace them — otherwise the method would
          // lose its probe explanation while still reporting the probe itself.
          const issues: NotificationHealthCheckIssue[] = verifyPendingProbesOnly
            ? (previousMethodResult?.is ?? []).filter((x) => !(willConsultProvider && isProbeIssueCode(x.c)))
            : [...notificationDeliveryMethodConfigIssues({ methodContext, notificationUser, notificationTemplateType, explicitOptIn }), ...(disabledMethodsByBox.get(method) ?? [])];

          // keep any previously resolved probe visible unless the provider supplies a newer one
          let probe: Maybe<NotificationHealthCheckProbe> = previousProbe;

          if (healthCheckService && target != null && providerHasSomethingToReport) {
            try {
              const response = await healthCheckService.runHealthCheck({
                method,
                target,
                uid,
                sendProbe,
                pendingProbe,
                notificationTemplateType,
                now
              });

              // on a verify-only run only the probe findings are refreshed
              issues.push(...(verifyPendingProbesOnly ? response.issues.filter((x) => isProbeIssueCode(x.c)) : response.issues));

              if (response.probe) {
                probe = response.probe;

                // A probe the provider gave no correlation id for cannot be told apart from the last one
                // by id, so the dispatch time is what settles whether this is a new attempt.
                if (response.probe.id !== previousProbe?.id || response.probe.at.getTime() !== previousProbe?.at.getTime()) {
                  probesDispatched += 1;
                } else if (pendingProbe && !isPendingNotificationHealthCheckProbe(response.probe)) {
                  probesResolved += 1;
                }
              }
            } catch (e) {
              issues.push(
                notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE, NotificationHealthCheckStatus.UNKNOWN, {
                  message: `The ${label.toLowerCase()} provider could not be reached, so its delivery status is unknown.`,
                  fix: 'Try again in a few minutes. If this keeps happening, the delivery provider may be having an outage.',
                  data: { error: `${e}` }
                })
              );
            }
          } else if (sendServiceConfigured && !healthCheckService && !verifyPendingProbesOnly && target != null) {
            issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE, NotificationHealthCheckStatus.SKIPPED, { message: `${label} delivery could not be verified with the provider, so only your settings were checked.`, data: { method } }));
          }

          const methodResult: NotificationDeliveryHealthCheckResult = {
            me: method,
            s: rollupNotificationDeliveryHealthCheckResultStatus({ is: issues, pr: probe }),
            tg: target == null ? undefined : String(target),
            is: issues,
            pr: probe,
            // whether probing is supported is only knowable here, so it is reported for a client that
            // offers a per-method test message action. A supporting provider with nothing to deliver to
            // still cannot be probed.
            pb: healthCheckService?.supportsProbe === true && target != null ? true : undefined
          };

          return methodResult;
        })
      );

      // A run can be scoped to a subset of methods (a probe poll usually is). Carry forward the
      // previous result for every method that was not re-checked so the stored health check stays a
      // complete picture rather than shrinking to whatever was last asked about.
      const freshResultsByMethod = new Map(methodResults.map((x) => [x.me, x]));
      const mergedMethodResults = filterMaybeArrayValues(methodContexts.map((x) => freshResultsByMethod.get(x.method) ?? previousHealthCheck?.m.find((y) => y.me === x.method)));

      const healthCheck: NotificationHealthCheck = {
        // A verify-only run refreshes the probe findings of the check that is already stored rather than
        // producing a new diagnosis, so it leaves `at` — and with it the user's run window — where it
        // was. Only `vat` moves, which is what a poll paces itself against.
        at: verifyPendingProbesOnly ? (previousHealthCheck?.at ?? now) : now,
        vat: now,
        s: rollupNotificationHealthCheckResultStatus({ is: accountIssues, m: mergedMethodResults }),
        t: notificationTemplateType,
        is: accountIssues,
        m: mergedMethodResults
      };

      await notificationUserDocument.update({ hc: healthCheck });

      // The complete check is what gets STORED; what comes BACK can be narrower. A probe run is about one
      // method's test message, and a client renders the report from the document anyway, so returning the
      // whole account's diagnosis is payload the caller did not ask for.
      //
      // The same predicate as the `pb` flag, so what is returned matches what the client was told it could
      // test. An empty set means nothing probe-capable was in scope, and then there is no narrower answer
      // to give than the diagnosis explaining why nothing was sent.
      const probedMethods = new Set(sendProbe ? methodContextsToCheck.filter((x) => x.healthCheckService?.supportsProbe === true && x.target != null).map((x) => x.method) : []);
      const returnFullHealthCheck = inputReturnFullHealthCheck === true || !sendProbe || probedMethods.size === 0;
      const returnedHealthCheck = returnFullHealthCheck ? healthCheck : narrowNotificationHealthCheckToMethods(healthCheck, probedMethods);

      return { healthCheck: returnedHealthCheck, probesDispatched, probesResolved };
    };
  });
}

// MARK: Autofix
/**
 * Factory for the `healthCheckAutofix` action on a {@link NotificationUser}.
 *
 * Fixes issues the user's stored health check reported as fixable, by handing them to the provider that
 * reported them, then checks that delivery method again so the stored check shows whether the fix worked.
 *
 * Only the stored check is trusted to say what is fixable and how. It was written by the server, and it is
 * what an admin reviewing the report sees, so the fix is limited to the issues on it and is applied to the
 * delivery target it recorded. An {@link NotificationHealthCheckIssueAutofixType.EXPLICIT} fix is refused
 * unless the request explicitly allows it.
 *
 * Privileged, and unverifiable from here: the action cannot see who is calling, so the API layer is
 * responsible for restricting it to admins. See {@link NotificationUserHealthCheckAutofixParams}.
 *
 * @param context - The notification server actions context.
 * @returns A transform-and-validate function that fixes a notification user's delivery issues.
 */
export function notificationUserHealthCheckAutofixFactory(context: NotificationServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, notificationSendService } = context;
  const notificationUserHealthCheck = notificationUserHealthCheckFactory(context);

  return firebaseServerActionTransformFunctionFactory(notificationUserHealthCheckAutofixParamsType, async (params: NotificationUserHealthCheckAutofixParams) => {
    const { method, codes: inputCodes, allowExplicitAutofix: inputAllowExplicitAutofix } = params;
    const codes = unique(inputCodes);
    const allowExplicitAutofix = inputAllowExplicitAutofix === true;

    return async (notificationUserDocument: NotificationUserDocument): Promise<NotificationUserHealthCheckAutofixResult> => {
      const now = new Date();
      const { uid, hc: storedHealthCheck } = await assertSnapshotData(notificationUserDocument);
      const storedMethodResult = notificationDeliveryHealthCheckResultForMethod(storedHealthCheck, method);
      const target = storedMethodResult?.tg;
      const healthCheckService = notificationSendServiceHealthCheckServiceForMethod(notificationSendService, method);

      const fixableIssuesByCode = new Map((storedMethodResult?.is ?? []).filter((x) => x.af != null).map((x) => [x.c, x]));
      const unfixableCodes = codes.filter((x) => !fixableIssuesByCode.has(x));

      if (storedMethodResult == null) {
        throw notificationUserHealthCheckAutofixUnavailableError({ method, codes, reason: 'this delivery method has not been checked yet. Run the health check first.' });
      } else if (unfixableCodes.length > 0) {
        throw notificationUserHealthCheckAutofixUnavailableError({ method, codes: unfixableCodes, reason: 'the most recent health check does not report them as fixable.' });
      } else if (healthCheckService?.runAutofix == null || target == null) {
        throw notificationUserHealthCheckAutofixUnavailableError({ method, codes, reason: 'the delivery provider cannot fix them.' });
      }

      const explicitCodes = codes.filter((x) => fixableIssuesByCode.get(x)?.af === NotificationHealthCheckIssueAutofixType.EXPLICIT);

      if (explicitCodes.length > 0 && !allowExplicitAutofix) {
        throw notificationUserHealthCheckAutofixNotAllowedError(explicitCodes);
      }

      const { results: providerResults } = await healthCheckService.runAutofix({ method, target, uid, codes, now });

      // one result per requested code, in the order requested, even if the provider left one out
      const providerResultsByCode = new Map(providerResults.map((x) => [x.code, x]));
      const results: NotificationHealthCheckIssueAutofixResult[] = codes.map((code) => providerResultsByCode.get(code) ?? { code, fixed: false, message: 'The delivery provider did not report an outcome for this fix.' });

      // Check the method again rather than editing the stored findings, so the report shows what the
      // provider says now. Forced because the check was usually run moments ago, and evaluated against
      // the same template type as the stored check so its other findings stay comparable.
      const runHealthCheckForMethod = await notificationUserHealthCheck({ key: notificationUserDocument.key, methods: [method], notificationTemplateType: storedHealthCheck?.t, force: true });
      const { healthCheck } = await runHealthCheckForMethod(notificationUserDocument);

      return { results, healthCheck };
    };
  });
}

/**
 * The provider health check service for a delivery method, if the method's send service has one.
 *
 * @param notificationSendService - The app's configured send service.
 * @param method - The delivery method.
 * @returns The method's health check service, or undefined when it has none.
 */
function notificationSendServiceHealthCheckServiceForMethod(notificationSendService: NotificationServerActionsContext['notificationSendService'], method: NotificationDeliveryMethod): Maybe<NotificationSendServiceHealthCheckService> {
  const healthCheckServices: Record<NotificationDeliveryMethod, Maybe<NotificationSendServiceHealthCheckService>> = {
    [NotificationDeliveryMethod.EMAIL]: notificationSendService.emailSendService?.healthCheckService,
    [NotificationDeliveryMethod.TEXT]: notificationSendService.textSendService?.healthCheckService,
    [NotificationDeliveryMethod.NOTIFICATION_SUMMARY]: notificationSendService.notificationSummarySendService?.healthCheckService,
    // push delivery is not part of the send service yet
    [NotificationDeliveryMethod.PUSH]: undefined
  };

  return healthCheckServices[method];
}

/**
 * Narrows a health check down to a subset of its delivery methods.
 *
 * Used for the result of a test message call, which is about the method it just sent through rather than
 * the whole account. `s` is re-rolled over the methods that are kept so the returned check is
 * self-consistent, and the account-wide findings are dropped — they are not what the call was about. Only
 * ever applied to the RETURNED value; the stored check keeps every method and finding.
 *
 * @param healthCheck - The complete check.
 * @param methods - The delivery methods to keep.
 * @returns The check, covering only those methods.
 */
function narrowNotificationHealthCheckToMethods(healthCheck: NotificationHealthCheck, methods: ReadonlySet<NotificationDeliveryMethod>): NotificationHealthCheck {
  const m = healthCheck.m.filter((x) => methods.has(x.me));
  return { ...healthCheck, is: [], m, s: rollupNotificationHealthCheckResultStatus({ is: [], m }) };
}

// MARK: Delivery Methods
interface BuildNotificationDeliveryMethodContextsInput {
  readonly notificationUser: NotificationUser;
  readonly notificationSendService: NotificationServerActionsContext['notificationSendService'];
  readonly authEmail: Maybe<EmailAddress>;
  readonly authPhone: Maybe<E164PhoneNumber>;
  readonly uid: FirebaseAuthUserId;
}

/**
 * Builds the per-method view of what is configured and where each method would deliver to.
 *
 * Target resolution mirrors the send pipeline (see {@link resolveNotificationUidRecipientDelivery}): the override on the
 * user's global config wins, otherwise the value on their Firebase Auth record is used. The default config's overrides
 * (`dc.e` / `dc.t`) are ignored, since they only apply to a few direct sends.
 *
 * @param input - The user, the configured send service, and their auth contact details.
 * @returns One context per delivery method, in report order.
 */
function buildNotificationDeliveryMethodContexts(input: BuildNotificationDeliveryMethodContextsInput): NotificationDeliveryMethodContext[] {
  const { notificationUser, notificationSendService, authEmail, authPhone, uid } = input;
  const { gc } = notificationUser;
  const { emailSendService, textSendService, notificationSummarySendService, notificationSummaryIdForUidFunction } = notificationSendService;

  const emailContext: NotificationDeliveryMethodContext<EmailAddress> = {
    method: NotificationDeliveryMethod.EMAIL,
    label: 'Email',
    sendServiceConfigured: emailSendService != null,
    healthCheckService: emailSendService?.healthCheckService,
    target: (gc.e ?? authEmail) as Maybe<EmailAddress>
  };

  const textContext: NotificationDeliveryMethodContext<E164PhoneNumber> = {
    method: NotificationDeliveryMethod.TEXT,
    label: 'Text message',
    sendServiceConfigured: textSendService != null,
    healthCheckService: textSendService?.healthCheckService,
    target: (gc.t ?? authPhone) as Maybe<E164PhoneNumber>
  };

  const summaryContext: NotificationDeliveryMethodContext<string> = {
    method: NotificationDeliveryMethod.NOTIFICATION_SUMMARY,
    label: 'In-app notification',
    sendServiceConfigured: notificationSummarySendService != null,
    healthCheckService: notificationSummarySendService?.healthCheckService,
    target: notificationSummaryIdForUidFunction?.(uid)
  };

  const pushContext: NotificationDeliveryMethodContext<string> = {
    method: NotificationDeliveryMethod.PUSH,
    label: 'Push notification',
    // push delivery is not part of the send service yet
    sendServiceConfigured: false
  };

  return [emailContext, textContext, summaryContext, pushContext] as NotificationDeliveryMethodContext[];
}

// MARK: Account Checks
interface NotificationUserAccountIssuesInput {
  readonly notificationUser: NotificationUser;
  /**
   * Whether the user's Firebase Auth record is disabled.
   */
  readonly accountDisabled: boolean;
  /**
   * Whether the user's Firebase Auth record could be read at all.
   */
  readonly accountExists: boolean;
}

/**
 * Evaluates the checks that suppress every delivery method at once, rather than any single one.
 *
 * Reported at the top level of the health check so a single account-wide problem does not appear once
 * per delivery method.
 *
 * @param input - The user and the state of their auth record.
 * @returns The account-wide findings.
 */
function notificationUserAccountIssues(input: NotificationUserAccountIssuesInput): NotificationHealthCheckIssue[] {
  const { notificationUser, accountDisabled, accountExists } = input;
  const { gc, dc, b, x } = notificationUser;

  const issues: NotificationHealthCheckIssue[] = [];

  if (!accountExists) {
    issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET, NotificationHealthCheckStatus.ERROR, { message: 'Your sign-in account could not be read, so no contact details could be resolved.', fix: 'Contact support with this report.' }));

    return issues; // nothing else can be determined without the auth record
  }

  if (accountDisabled) {
    issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.RECIPIENT_DISABLED, NotificationHealthCheckStatus.ERROR, { message: 'Your account is disabled, so no notifications are being sent to you.', fix: 'Contact support to have your account re-enabled.' }));
  }

  // The global config is applied as a final override at send time, so it is the decisive one.
  const flagScopes: [string, Maybe<NotificationBoxRecipientFlag>][] = [
    ['global', gc.f],
    ['default', dc.f]
  ];

  flagScopes.forEach(([scope, flag]) => {
    if (flag === NotificationBoxRecipientFlag.OPT_OUT) {
      issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.RECIPIENT_OPTED_OUT, NotificationHealthCheckStatus.ERROR, { message: 'You have opted out of notifications, so none are being sent to you.', fix: 'Turn notifications back on in your notification settings.', data: { scope } }));
    } else if (flag === NotificationBoxRecipientFlag.DISABLED) {
      issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.RECIPIENT_DISABLED, NotificationHealthCheckStatus.ERROR, { message: 'Notifications have been turned off for your account, so none are being sent to you.', fix: 'Contact support to have notifications re-enabled.', data: { scope } }));
    }
  });

  if (!b.length) {
    issues.push(
      notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NO_NOTIFICATION_BOXES, NotificationHealthCheckStatus.WARNING, {
        message: 'You are not subscribed to notifications for anything yet, so there is nothing to notify you about.',
        fix: 'This usually resolves itself once you are added to a group or record that sends notifications.'
      })
    );
  }

  if (x.length) {
    issues.push(
      notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NOTIFICATION_BOX_EXCLUSIONS, NotificationHealthCheckStatus.WARNING, {
        message: `Notifications from ${x.length} subscription${x.length === 1 ? '' : 's'} are being suppressed for your account.`,
        fix: 'Contact support if you expect notifications from one of these.',
        data: { exclusions: takeFront(x, 10) }
      })
    );
  }

  return issues;
}

// MARK: Configuration Checks
interface NotificationDeliveryMethodConfigIssuesInput {
  readonly methodContext: NotificationDeliveryMethodContext;
  readonly notificationUser: NotificationUser;
  readonly notificationTemplateType: NotificationTemplateType;
  readonly explicitOptIn: Maybe<NotificationExplicitOptInConfig>;
}

/**
 * Evaluates the user's own configuration for a single delivery method.
 *
 * Resolves the method the same way {@link expandNotificationRecipients} does for a direct send (see
 * {@link resolveNotificationUidRecipientDelivery}), so each finding corresponds to a real reason the send pipeline would drop a message.
 *
 * @param input - The delivery method context, the user, the template type being evaluated and its opt-in rules.
 * @returns The findings for the method.
 */
function notificationDeliveryMethodConfigIssues(input: NotificationDeliveryMethodConfigIssuesInput): NotificationHealthCheckIssue[] {
  const { methodContext, notificationUser, notificationTemplateType, explicitOptIn } = input;
  const { method, label, sendServiceConfigured, target } = methodContext;
  const { gc, dc } = notificationUser;

  const issues: NotificationHealthCheckIssue[] = [];

  if (!sendServiceConfigured) {
    issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_NOT_CONFIGURED, NotificationHealthCheckStatus.SKIPPED, { message: `${label} notifications are not enabled on this system.`, data: { method } }));

    return issues; // nothing else about this method is meaningful
  }

  // reported before the destination check, so someone who switched the method off is not asked to add a destination for it
  if (isNotificationDeliveryMethodDisabled(gc, method)) {
    issues.push(
      notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_GLOBALLY, NotificationHealthCheckStatus.ERROR, {
        message: `You have switched off ${label.toLowerCase()} notifications.`,
        fix: `Turn ${label.toLowerCase()} back on in your notification settings.`,
        data: { method, scope: 'global', disabledDeliveryMethod: true }
      })
    );

    return issues;
  }

  if (target == null) {
    issues.push(
      notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET, NotificationHealthCheckStatus.ERROR, {
        message: `There is no ${label.toLowerCase()} destination on your account, so nothing can be delivered.`,
        fix: method === NotificationDeliveryMethod.EMAIL ? 'Add an email address to your account.' : 'Add a phone number to your notification settings.',
        data: { method }
      })
    );

    return issues; // every remaining check is about a destination that does not exist
  }

  if (isNotificationDeliveryMethodDisabled(dc, method)) {
    issues.push(
      notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_GLOBALLY, NotificationHealthCheckStatus.WARNING, {
        message: `${label} is switched off in your default settings, so notifications sent to you directly will not use it.`,
        fix: `Turn ${label.toLowerCase()} back on in your default notification settings.`,
        data: { method, scope: 'default', disabledDeliveryMethod: true }
      })
    );

    return issues;
  }

  // the opt-out flags are reported with the account findings, so only the method's own decision is evaluated here
  const { decisions } = resolveNotificationUidRecipientDelivery({ notificationTemplateType, explicitOptIn, notificationUser: { gc, dc, x: [] } });
  const decision = decisions[method];

  if (!decision.send) {
    if (decision.source === NotificationDeliveryMethodDecisionSource.CONFIG && decision.configIndex === 0) {
      issues.push(
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_GLOBALLY, NotificationHealthCheckStatus.ERROR, {
          message: `${label} is switched off for you across every notification, which overrides all other settings.`,
          fix: `Turn ${label.toLowerCase()} back on in your notification settings.`,
          data: { method, notificationTemplateType, scope: 'global' }
        })
      );
    } else if (decision.source === NotificationDeliveryMethodDecisionSource.CONFIG) {
      issues.push(
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_TEMPLATE, NotificationHealthCheckStatus.WARNING, {
          message: `${label} is switched off in your default settings for this kind of notification.`,
          fix: `Turn ${label.toLowerCase()} back on for this notification type.`,
          data: { method, notificationTemplateType, scope: 'default' }
        })
      );
    } else if (decision.source === NotificationDeliveryMethodDecisionSource.DEFAULT) {
      issues.push(
        notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_TEMPLATE, NotificationHealthCheckStatus.WARNING, {
          message: `${label} is only sent to people who have turned it on, and you have not turned it on.`,
          fix: `Turn ${label.toLowerCase()} on in your notification settings.`,
          data: { method, notificationTemplateType, requiresExplicitOptIn: true }
        })
      );
    }
  }

  return issues;
}

// MARK: Subscription Checks
interface InspectNotificationUserSubscriptionsInput {
  readonly notificationUser: NotificationUser;
  readonly notificationBoxCollection: NotificationServerActionsContext['notificationBoxCollection'];
  readonly notificationTemplateType: NotificationTemplateType;
  readonly explicitOptIn: Maybe<NotificationExplicitOptInConfig>;
}

interface InspectNotificationUserSubscriptionsResult {
  /**
   * Findings that apply regardless of delivery method.
   */
  readonly sharedIssues: NotificationHealthCheckIssue[];
  /**
   * Findings scoped to a single delivery method.
   */
  readonly issuesByMethod: Map<NotificationDeliveryMethod, NotificationHealthCheckIssue[]>;
}

/**
 * Inspects the user's notification box subscriptions.
 *
 * This catches the failure modes that live between the user's own settings and the boxes that actually
 * drive delivery: a config that never synced across, a box that was never initialized, or a recipient
 * entry that was disabled or excluded on the box side.
 *
 * @param input - The user, the notification box collection, and the template type being evaluated.
 * @returns The account-wide findings plus any findings scoped to a single delivery method.
 */
async function inspectNotificationUserSubscriptions(input: InspectNotificationUserSubscriptionsInput): Promise<InspectNotificationUserSubscriptionsResult> {
  const { notificationUser, notificationBoxCollection, notificationTemplateType, explicitOptIn } = input;
  const { uid, bc, ns, gc } = notificationUser;

  const sharedIssues: NotificationHealthCheckIssue[] = [];
  const issuesByMethod = new Map<NotificationDeliveryMethod, NotificationHealthCheckIssue[]>();

  if (ns) {
    sharedIssues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC, NotificationHealthCheckStatus.WARNING, { message: 'Your notification settings have not finished saving everywhere yet.', fix: 'This usually clears itself within a few minutes. Re-run this check to confirm.' }));
  }

  const activeConfigs = bc.filter((x) => !x.rm);
  const configsToInspect = takeFront(activeConfigs, DEFAULT_MAX_NOTIFICATION_BOXES_TO_INSPECT_PER_HEALTH_CHECK);

  if (!configsToInspect.length) {
    return { sharedIssues, issuesByMethod };
  }

  const documentAccessor = notificationBoxCollection.documentAccessor();
  const boxPairs = await Promise.all(
    configsToInspect.map(async (config) => {
      const box = await documentAccessor
        .loadDocumentForId(config.nb)
        .snapshotData()
        .catch(() => undefined);
      return { config, box };
    })
  );

  const uninitializedBoxIds: NotificationBoxId[] = [];
  const invalidBoxIds: NotificationBoxId[] = [];
  const unsyncedBoxIds: NotificationBoxId[] = [];
  const disabledBoxIdsByMethod = new Map<NotificationDeliveryMethod, NotificationBoxId[]>();

  boxPairs.forEach(({ config, box }) => {
    if (!box) {
      return; // a box that has never been created simply has nothing to send
    }

    if (box.fi) {
      invalidBoxIds.push(config.nb);
    } else if (box.s) {
      uninitializedBoxIds.push(config.nb);
    }

    const boxRecipient = box.r.find((x) => x.uid === uid);

    if (!boxRecipient || config.ns) {
      unsyncedBoxIds.push(config.nb);
    }

    collectDisabledMethodsForBoxRecipient({ boxRecipient, config, gc, notificationTemplateType, explicitOptIn }).forEach((method) => {
      const existing = disabledBoxIdsByMethod.get(method) ?? [];
      existing.push(config.nb);
      disabledBoxIdsByMethod.set(method, existing);
    });
  });

  if (invalidBoxIds.length) {
    sharedIssues.push(
      notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_BROKEN, NotificationHealthCheckStatus.ERROR, {
        message: `${invalidBoxIds.length} of your subscriptions are broken and will not send notifications.`,
        fix: 'Contact support with this report so the subscription can be repaired.',
        data: { notificationBoxIds: invalidBoxIds }
      })
    );
  }

  if (uninitializedBoxIds.length) {
    sharedIssues.push(
      notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_NOT_READY, NotificationHealthCheckStatus.WARNING, {
        message: `${uninitializedBoxIds.length} of your subscriptions are still being set up, so their notifications are delayed.`,
        fix: 'This usually clears itself within a few minutes.',
        data: { notificationBoxIds: uninitializedBoxIds }
      })
    );
  }

  if (unsyncedBoxIds.length) {
    sharedIssues.push(
      notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC, NotificationHealthCheckStatus.WARNING, {
        message: `Your settings for ${unsyncedBoxIds.length} subscription${unsyncedBoxIds.length === 1 ? '' : 's'} have not been applied yet.`,
        fix: 'Re-run this check in a few minutes. If it persists, contact support with this report.',
        data: { notificationBoxIds: unsyncedBoxIds }
      })
    );
  }

  disabledBoxIdsByMethod.forEach((notificationBoxIds, method) => {
    issuesByMethod.set(method, [
      notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_BOX, NotificationHealthCheckStatus.WARNING, {
        message: `This delivery method is switched off for ${notificationBoxIds.length} of your subscriptions.`,
        fix: 'Check the per-subscription settings in your notification settings.',
        data: { method, notificationBoxIds }
      })
    ]);
  });

  return { sharedIssues, issuesByMethod };
}

interface CollectDisabledMethodsForBoxRecipientInput {
  readonly boxRecipient: Maybe<NotificationBoxRecipient>;
  readonly config: NotificationUserNotificationBoxRecipientConfig;
  readonly gc: NotificationUser['gc'];
  readonly notificationTemplateType: NotificationTemplateType;
  readonly explicitOptIn: Maybe<NotificationExplicitOptInConfig>;
}

/**
 * Determines which delivery methods are switched off for a user within a single notification box.
 *
 * Reads the box's own recipient entry when present, since that is what the send pipeline consults,
 * and falls back to the user's mirrored config otherwise. Only methods the box entry decides are
 * reported: a method the user's global config sets overrides the box entry at send time.
 *
 * @param input - The box's recipient entry, the user's mirrored config, their global config, and the template type.
 * @returns The delivery methods switched off for the user in this box.
 */
function collectDisabledMethodsForBoxRecipient(input: CollectDisabledMethodsForBoxRecipientInput): NotificationDeliveryMethod[] {
  const { boxRecipient, config, gc, notificationTemplateType, explicitOptIn } = input;
  const effectiveRecipient = boxRecipient ?? config;

  // a flagged or excluded recipient receives nothing at all from this box, which is reported
  // separately rather than as a per-method finding
  if (effectiveRecipient.f || effectiveRecipient.x) {
    return [];
  }

  const decisions = resolveNotificationDeliveryMethodDecisions({ configs: [gc.c?.[notificationTemplateType], effectiveRecipient.c?.[notificationTemplateType]], explicitOptIn });

  return ALL_NOTIFICATION_DELIVERY_METHODS.filter((method) => {
    const decision = decisions[method];
    return !decision.send && decision.source === NotificationDeliveryMethodDecisionSource.CONFIG && decision.configIndex === 1;
  });
}

/**
 * True if the issue code describes a delivery probe rather than a configuration finding.
 *
 * @param code - The issue code to test.
 * @returns True if the code is one of the probe lifecycle codes.
 */
function isProbeIssueCode(code: string): boolean {
  return PROBE_NOTIFICATION_HEALTH_CHECK_ISSUE_CODES.has(code);
}
