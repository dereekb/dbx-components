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
 * probe dispatched by one run is resolved by a later one.
 */
import {
  type FirebaseAuthUserId,
  type NotificationBoxId,
  type NotificationBoxRecipient,
  NotificationBoxRecipientFlag,
  type NotificationBoxRecipientTemplateConfig,
  type NotificationDeliveryHealthCheckResult,
  NotificationDeliveryMethod,
  type NotificationHealthCheck,
  type NotificationHealthCheckIssue,
  type NotificationHealthCheckProbe,
  NotificationHealthCheckStatus,
  type NotificationTemplateType,
  type NotificationUser,
  type NotificationUserDocument,
  type NotificationUserHealthCheckParams,
  type NotificationUserHealthCheckResult,
  type NotificationUserNotificationBoxRecipientConfig,
  DEFAULT_NOTIFICATION_TEMPLATE_TYPE,
  KnownNotificationHealthCheckIssueCode,
  effectiveNotificationBoxRecipientTemplateConfig,
  isPendingNotificationHealthCheckProbe,
  notificationHealthCheckIssue,
  notificationUserHealthCheckParamsType,
  rollupNotificationDeliveryHealthCheckResultStatus,
  rollupNotificationHealthCheckResultStatus
} from '@dereekb/firebase';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { type EmailAddress, type E164PhoneNumber, type Maybe, filterMaybeArrayValues, takeFront } from '@dereekb/util';
import { type NotificationServerActionsContext } from './notification.action.server';
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
  /**
   * Reads the method's flag out of an effective template config.
   */
  readonly readTemplateConfigFlag: (config: NotificationBoxRecipientTemplateConfig) => Maybe<boolean>;
  /**
   * Whether the send pipeline requires this method to be *explicitly* enabled.
   *
   * Text/SMS defaults to opt-in only, so an absent config means "will not send" for text but
   * "will send" for email — a distinction worth reporting plainly.
   */
  readonly requiresExplicitOptIn: boolean;
}

/**
 * Factory for the `healthCheck` action on a {@link NotificationUser}.
 *
 * @param context - The notification server actions context.
 * @returns A transform-and-validate function that runs a delivery health check for a notification user.
 */
export function notificationUserHealthCheckFactory(context: NotificationServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, notificationBoxCollection, notificationSendService, authService } = context;

  return firebaseServerActionTransformFunctionFactory(notificationUserHealthCheckParamsType, async (params: NotificationUserHealthCheckParams) => {
    const { methods: inputMethods, sendProbe: inputSendProbe, verifyPendingProbesOnly: inputVerifyPendingProbesOnly, notificationTemplateType: inputNotificationTemplateType, skipSubscriptionChecks: inputSkipSubscriptionChecks } = params;

    const sendProbe = inputSendProbe === true;
    const verifyPendingProbesOnly = inputVerifyPendingProbesOnly === true;
    const skipSubscriptionChecks = inputSkipSubscriptionChecks === true || verifyPendingProbesOnly;

    return async (notificationUserDocument: NotificationUserDocument): Promise<NotificationUserHealthCheckResult> => {
      const now = new Date();
      const notificationUser = await assertSnapshotData(notificationUserDocument);
      const { uid, hc: previousHealthCheck } = notificationUser;

      const notificationTemplateType = inputNotificationTemplateType || DEFAULT_NOTIFICATION_TEMPLATE_TYPE;
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
      const subscriptions = skipSubscriptionChecks ? undefined : await inspectNotificationUserSubscriptions({ notificationUser, notificationBoxCollection, notificationTemplateType });
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

          // whether the provider will be consulted, and so whether fresh probe findings are coming
          const willConsultProvider = healthCheckService != null && target != null;

          // A verify-only run carries the previous findings forward. The stale probe findings are only
          // dropped when the provider is actually going to replace them — otherwise the method would
          // lose its probe explanation while still reporting the probe itself.
          const issues: NotificationHealthCheckIssue[] = verifyPendingProbesOnly ? (previousMethodResult?.is ?? []).filter((x) => !(willConsultProvider && isProbeIssueCode(x.c))) : [...notificationDeliveryMethodConfigIssues({ methodContext, notificationUser, notificationTemplateType }), ...(disabledMethodsByBox.get(method) ?? [])];

          // keep any previously resolved probe visible unless the provider supplies a newer one
          let probe: Maybe<NotificationHealthCheckProbe> = previousProbe;

          if (healthCheckService && target != null) {
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

                if (response.probe.id !== previousProbe?.id) {
                  probesDispatched += 1;
                } else if (pendingProbe && !isPendingNotificationHealthCheckProbe(response.probe)) {
                  probesResolved += 1;
                }
              }
            } catch (e) {
              issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE, NotificationHealthCheckStatus.UNKNOWN, { message: `The ${label.toLowerCase()} provider could not be reached, so its delivery status is unknown.`, fix: 'Try again in a few minutes. If this keeps happening, the delivery provider may be having an outage.', data: { error: `${e}` } }));
            }
          } else if (sendServiceConfigured && !healthCheckService && !verifyPendingProbesOnly && target != null) {
            issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE, NotificationHealthCheckStatus.SKIPPED, { message: `${label} delivery could not be verified with the provider, so only your settings were checked.`, data: { method } }));
          }

          const methodResult: NotificationDeliveryHealthCheckResult = {
            me: method,
            s: rollupNotificationDeliveryHealthCheckResultStatus({ is: issues, pr: probe }),
            tg: target == null ? undefined : String(target),
            is: issues,
            pr: probe
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
        at: now,
        s: rollupNotificationHealthCheckResultStatus({ is: accountIssues, m: mergedMethodResults }),
        t: notificationTemplateType,
        is: accountIssues,
        m: mergedMethodResults
      };

      await notificationUserDocument.update({ hc: healthCheck });

      return { healthCheck, probesDispatched, probesResolved };
    };
  });
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
 * Target resolution mirrors the send pipeline: a recipient's explicit override on their global or
 * default config wins, otherwise the value on their Firebase Auth record is used.
 *
 * @param input - The user, the configured send service, and their auth contact details.
 * @returns One context per delivery method, in report order.
 */
function buildNotificationDeliveryMethodContexts(input: BuildNotificationDeliveryMethodContextsInput): NotificationDeliveryMethodContext[] {
  const { notificationUser, notificationSendService, authEmail, authPhone, uid } = input;
  const { gc, dc } = notificationUser;
  const { emailSendService, textSendService, notificationSummarySendService, notificationSummaryIdForUidFunction } = notificationSendService;

  const emailContext: NotificationDeliveryMethodContext<EmailAddress> = {
    method: NotificationDeliveryMethod.EMAIL,
    label: 'Email',
    sendServiceConfigured: emailSendService != null,
    healthCheckService: emailSendService?.healthCheckService,
    target: (gc.e ?? dc.e ?? authEmail) as Maybe<EmailAddress>,
    readTemplateConfigFlag: (x) => x.se,
    requiresExplicitOptIn: false
  };

  const textContext: NotificationDeliveryMethodContext<E164PhoneNumber> = {
    method: NotificationDeliveryMethod.TEXT,
    label: 'Text message',
    sendServiceConfigured: textSendService != null,
    healthCheckService: textSendService?.healthCheckService,
    target: (gc.t ?? dc.t ?? authPhone) as Maybe<E164PhoneNumber>,
    readTemplateConfigFlag: (x) => x.st,
    // the send pipeline only texts recipients who have explicitly opted in
    requiresExplicitOptIn: true
  };

  const summaryContext: NotificationDeliveryMethodContext<string> = {
    method: NotificationDeliveryMethod.NOTIFICATION_SUMMARY,
    label: 'In-app notification',
    sendServiceConfigured: notificationSummarySendService != null,
    healthCheckService: notificationSummarySendService?.healthCheckService,
    target: notificationSummaryIdForUidFunction?.(uid),
    readTemplateConfigFlag: (x) => x.sn,
    requiresExplicitOptIn: false
  };

  const pushContext: NotificationDeliveryMethodContext<string> = {
    method: NotificationDeliveryMethod.PUSH,
    label: 'Push notification',
    // push delivery is not part of the send service yet
    sendServiceConfigured: false,
    readTemplateConfigFlag: (x) => x.sp,
    requiresExplicitOptIn: true
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
    issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NO_NOTIFICATION_BOXES, NotificationHealthCheckStatus.WARNING, { message: 'You are not subscribed to notifications for anything yet, so there is nothing to notify you about.', fix: 'This usually resolves itself once you are added to a group or record that sends notifications.' }));
  }

  if (x.length) {
    issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NOTIFICATION_BOX_EXCLUSIONS, NotificationHealthCheckStatus.WARNING, { message: `Notifications from ${x.length} subscription${x.length === 1 ? '' : 's'} are being suppressed for your account.`, fix: 'Contact support if you expect notifications from one of these.', data: { exclusions: takeFront(x, 10) } }));
  }

  return issues;
}

// MARK: Configuration Checks
interface NotificationDeliveryMethodConfigIssuesInput {
  readonly methodContext: NotificationDeliveryMethodContext;
  readonly notificationUser: NotificationUser;
  readonly notificationTemplateType: NotificationTemplateType;
}

/**
 * Evaluates the user's own configuration for a single delivery method.
 *
 * These mirror the gates in {@link expandNotificationRecipients}, so each finding corresponds to a real
 * reason the send pipeline would drop a message.
 *
 * @param input - The delivery method context, the user, and the template type being evaluated.
 * @returns The findings for the method.
 */
function notificationDeliveryMethodConfigIssues(input: NotificationDeliveryMethodConfigIssuesInput): NotificationHealthCheckIssue[] {
  const { methodContext, notificationUser, notificationTemplateType } = input;
  const { method, label, sendServiceConfigured, target, readTemplateConfigFlag, requiresExplicitOptIn } = methodContext;
  const { gc, dc } = notificationUser;

  const issues: NotificationHealthCheckIssue[] = [];

  if (!sendServiceConfigured) {
    issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_NOT_CONFIGURED, NotificationHealthCheckStatus.SKIPPED, { message: `${label} notifications are not enabled on this system.`, data: { method } }));

    return issues; // nothing else about this method is meaningful
  }

  if (target == null) {
    issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET, NotificationHealthCheckStatus.ERROR, { message: `There is no ${label.toLowerCase()} destination on your account, so nothing can be delivered.`, fix: method === NotificationDeliveryMethod.EMAIL ? 'Add an email address to your account.' : 'Add a phone number to your notification settings.', data: { method } }));

    return issues; // every remaining check is about a destination that does not exist
  }

  // per-template channel flags on the global and default configs
  const globalTemplateFlag = readEffectiveTemplateConfigFlag(gc.c?.[notificationTemplateType], readTemplateConfigFlag);
  const defaultTemplateFlag = readEffectiveTemplateConfigFlag(dc.c?.[notificationTemplateType], readTemplateConfigFlag);

  if (globalTemplateFlag === false) {
    issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_GLOBALLY, NotificationHealthCheckStatus.ERROR, { message: `${label} is switched off for you across every notification, which overrides all other settings.`, fix: `Turn ${label.toLowerCase()} back on in your notification settings.`, data: { method, notificationTemplateType, scope: 'global' } }));
  } else if (defaultTemplateFlag === false) {
    issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_TEMPLATE, NotificationHealthCheckStatus.WARNING, { message: `${label} is switched off in your default settings for this kind of notification.`, fix: `Turn ${label.toLowerCase()} back on for this notification type.`, data: { method, notificationTemplateType, scope: 'default' } }));
  } else if (requiresExplicitOptIn && globalTemplateFlag !== true && defaultTemplateFlag !== true) {
    issues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_TEMPLATE, NotificationHealthCheckStatus.WARNING, { message: `${label} is only sent to people who have turned it on, and you have not turned it on.`, fix: `Turn ${label.toLowerCase()} on in your notification settings.`, data: { method, notificationTemplateType, requiresExplicitOptIn: true } }));
  }

  return issues;
}

/**
 * Resolves a single channel flag out of a template config, applying the `sd` send-default fallback.
 *
 * @param config - The template config to read, if the user has one for this template type.
 * @param readFlag - Selects the delivery method's flag out of an effective config.
 * @returns The flag's effective value, or undefined when the config leaves it unset.
 */
function readEffectiveTemplateConfigFlag(config: Maybe<NotificationBoxRecipientTemplateConfig>, readFlag: (config: NotificationBoxRecipientTemplateConfig) => Maybe<boolean>): Maybe<boolean> {
  return config ? readFlag(effectiveNotificationBoxRecipientTemplateConfig(config)) : undefined;
}

// MARK: Subscription Checks
interface InspectNotificationUserSubscriptionsInput {
  readonly notificationUser: NotificationUser;
  readonly notificationBoxCollection: NotificationServerActionsContext['notificationBoxCollection'];
  readonly notificationTemplateType: NotificationTemplateType;
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
  const { notificationUser, notificationBoxCollection, notificationTemplateType } = input;
  const { uid, bc, ns } = notificationUser;

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

    collectDisabledMethodsForBoxRecipient({ boxRecipient, config, notificationTemplateType }).forEach((method) => {
      const existing = disabledBoxIdsByMethod.get(method) ?? [];
      existing.push(config.nb);
      disabledBoxIdsByMethod.set(method, existing);
    });
  });

  if (invalidBoxIds.length) {
    sharedIssues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_BROKEN, NotificationHealthCheckStatus.ERROR, { message: `${invalidBoxIds.length} of your subscriptions are broken and will not send notifications.`, fix: 'Contact support with this report so the subscription can be repaired.', data: { notificationBoxIds: invalidBoxIds } }));
  }

  if (uninitializedBoxIds.length) {
    sharedIssues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_NOT_READY, NotificationHealthCheckStatus.WARNING, { message: `${uninitializedBoxIds.length} of your subscriptions are still being set up, so their notifications are delayed.`, fix: 'This usually clears itself within a few minutes.', data: { notificationBoxIds: uninitializedBoxIds } }));
  }

  if (unsyncedBoxIds.length) {
    sharedIssues.push(notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC, NotificationHealthCheckStatus.WARNING, { message: `Your settings for ${unsyncedBoxIds.length} subscription${unsyncedBoxIds.length === 1 ? '' : 's'} have not been applied yet.`, fix: 'Re-run this check in a few minutes. If it persists, contact support with this report.', data: { notificationBoxIds: unsyncedBoxIds } }));
  }

  disabledBoxIdsByMethod.forEach((notificationBoxIds, method) => {
    issuesByMethod.set(method, [notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_BOX, NotificationHealthCheckStatus.WARNING, { message: `This delivery method is switched off for ${notificationBoxIds.length} of your subscriptions.`, fix: 'Check the per-subscription settings in your notification settings.', data: { method, notificationBoxIds } })]);
  });

  return { sharedIssues, issuesByMethod };
}

interface CollectDisabledMethodsForBoxRecipientInput {
  readonly boxRecipient: Maybe<NotificationBoxRecipient>;
  readonly config: NotificationUserNotificationBoxRecipientConfig;
  readonly notificationTemplateType: NotificationTemplateType;
}

/**
 * Determines which delivery methods are switched off for a user within a single notification box.
 *
 * Reads the box's own recipient entry when present, since that is what the send pipeline consults,
 * and falls back to the user's mirrored config otherwise.
 *
 * @param input - The box's recipient entry, the user's mirrored config, and the template type.
 * @returns The delivery methods explicitly switched off for the user in this box.
 */
function collectDisabledMethodsForBoxRecipient(input: CollectDisabledMethodsForBoxRecipientInput): NotificationDeliveryMethod[] {
  const { boxRecipient, config, notificationTemplateType } = input;
  const effectiveRecipient = boxRecipient ?? config;

  // a flagged or excluded recipient receives nothing at all from this box, which is reported
  // separately rather than as a per-method finding
  if (effectiveRecipient.f || effectiveRecipient.x) {
    return [];
  }

  const templateConfig = effectiveRecipient.c?.[notificationTemplateType];

  if (!templateConfig) {
    return [];
  }

  const effective = effectiveNotificationBoxRecipientTemplateConfig(templateConfig);

  return filterMaybeArrayValues([
    //
    effective.se === false ? NotificationDeliveryMethod.EMAIL : undefined,
    effective.st === false ? NotificationDeliveryMethod.TEXT : undefined,
    effective.sp === false ? NotificationDeliveryMethod.PUSH : undefined,
    effective.sn === false ? NotificationDeliveryMethod.NOTIFICATION_SUMMARY : undefined
  ]);
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
