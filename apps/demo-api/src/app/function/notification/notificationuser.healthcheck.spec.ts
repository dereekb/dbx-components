import { demoCallModel } from './../model/crud.functions';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoNotificationBoxContext, demoNotificationUserContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import {
  type NotificationHealthCheckIssue,
  type NotificationHealthCheckProbe,
  type NotificationUserHealthCheckParams,
  type NotificationUserHealthCheckResult,
  type UpdateNotificationUserParams,
  NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLED_ERROR_CODE,
  NOTIFICATION_USER_HEALTH_CHECK_THROTTLED_ERROR_CODE,
  NOTIFICATION_USER_HEALTH_CHECK_VERIFY_THROTTLED_ERROR_CODE,
  NotificationBoxRecipientFlag,
  NotificationDeliveryMethod,
  NotificationHealthCheckStatus,
  KnownNotificationHealthCheckIssueCode,
  notificationDeliveryHealthCheckResultForMethod,
  notificationUserIdentity,
  onCallInvokeModelParams,
  onCallUpdateModelParams
} from '@dereekb/firebase';
import { type NotificationSendServiceHealthCheckService, type NotificationSummarySendServiceHealthCheckService, type NotificationTextSendServiceHealthCheckService } from '@dereekb/firebase-server/model';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { addMinutes, addSeconds } from 'date-fns';
import { DEMO_NOTIFICATION_HEALTH_CHECK_PROBE_THROTTLE_MINUTES, DEMO_NOTIFICATION_HEALTH_CHECK_RUN_THROTTLE_MINUTES, DEMO_NOTIFICATION_HEALTH_CHECK_VERIFY_THROTTLE_SECONDS, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';

/**
 * Reads the codes out of a set of issues, for order-independent assertions.
 */
function issueCodes(issues: NotificationHealthCheckIssue[]): string[] {
  return issues.map((x) => x.c);
}

/**
 * Finds a single issue by code. Several branches share a code and differ only by status/detail, so
 * assertions target the code and then inspect the issue rather than counting the array.
 */
function issueForCode(issues: NotificationHealthCheckIssue[], code: string): NotificationHealthCheckIssue | undefined {
  return issues.find((x) => x.c === code);
}

const TEST_PHONE_NUMBER = '+12088888888';

/**
 * Attaches a provider health check to a channel's send service.
 *
 * Safe without a reset: the Nest module is rebuilt for every test, so the demo's
 * `ignoreSendNotificationTextSendService()` comes back unmodified each time.
 */
function setSendServiceHealthCheckService(sendService: unknown, healthCheckService: NotificationSendServiceHealthCheckService<never>): void {
  (sendService as { healthCheckService?: unknown }).healthCheckService = healthCheckService;
}

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notificationUser.healthCheck', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserAdminContext({ f }, (u) => {
      demoProfileContext({ f, u }, (p) => {
        demoNotificationUserContext({ f, u }, (nu) => {
          async function runHealthCheck(params?: Partial<NotificationUserHealthCheckParams>): Promise<NotificationUserHealthCheckResult> {
            const fullParams: NotificationUserHealthCheckParams = {
              key: nu.documentKey,
              notificationTemplateType: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
              // the text channel has no provider health check wired, so restricting to it keeps these
              // assertions about configuration only and off the network
              methods: [NotificationDeliveryMethod.TEXT],
              ...params
            };

            return u.callWrappedFunction(demoCallModelWrappedFn, onCallInvokeModelParams(notificationUserIdentity, fullParams, 'healthCheck')) as Promise<NotificationUserHealthCheckResult>;
          }

          async function updateNotificationUser(params: Omit<UpdateNotificationUserParams, 'key'>): Promise<void> {
            await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationUserIdentity, { key: nu.documentKey, ...params }));
          }

          /**
           * Backdates the stored check so the server's run throttle allows another run.
           *
           * The throttle is derived from the persisted check's `at`, so moving it into the past is how a
           * test that needs consecutive runs simulates the wait instead of sleeping through it.
           */
          async function passHealthCheckThrottleWindow(): Promise<void> {
            const { hc } = await assertSnapshotData(nu.document);

            if (hc != null) {
              await nu.document.update({ hc: { ...hc, at: addMinutes(new Date(), -(DEMO_NOTIFICATION_HEALTH_CHECK_RUN_THROTTLE_MINUTES + 1)) } });
            }
          }

          /**
           * Backdates the stored check by an exact number of minutes, for asserting which window is in
           * force rather than simply clearing it.
           */
          async function backdateHealthCheck(minutes: number): Promise<void> {
            const { hc } = await assertSnapshotData(nu.document);

            if (hc != null) {
              const at = addMinutes(new Date(), -minutes);
              await nu.document.update({ hc: { ...hc, at, m: hc.m.map((x) => (x.pr ? { ...x, pr: { ...x.pr, at } } : x)) } });
            }
          }

          /**
           * Backdates the stored probes so the server's probe throttle allows another test message.
           *
           * The probe window is keyed on the most recent dispatch rather than the check itself, so this
           * moves each method's probe into the past.
           */
          async function passHealthCheckProbeThrottleWindow(): Promise<void> {
            const { hc } = await assertSnapshotData(nu.document);

            if (hc != null) {
              const at = addMinutes(new Date(), -(DEMO_NOTIFICATION_HEALTH_CHECK_PROBE_THROTTLE_MINUTES + 1));
              await nu.document.update({ hc: { ...hc, m: hc.m.map((x) => (x.pr ? { ...x, pr: { ...x.pr, at } } : x)) } });
            }
          }

          /**
           * Backdates the stored check's verification time so the server's verify window allows another
           * poll.
           *
           * Keyed on `vat` rather than `at`, which is the whole point of the window: a poll of an
           * in-flight test message neither answers to nor consumes the run allowance.
           */
          async function passHealthCheckVerifyThrottleWindow(): Promise<void> {
            const { hc } = await assertSnapshotData(nu.document);

            if (hc != null) {
              await nu.document.update({ hc: { ...hc, vat: addSeconds(new Date(), -(DEMO_NOTIFICATION_HEALTH_CHECK_VERIFY_THROTTLE_SECONDS + 1)) } });
            }
          }

          it('should return a health check for each requested delivery method', async () => {
            const { healthCheck } = await runHealthCheck({ methods: [NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.NOTIFICATION_SUMMARY] });

            expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT)).toBeDefined();
            expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.NOTIFICATION_SUMMARY)).toBeDefined();
            expect(healthCheck.at).toBeDefined();
            expect(healthCheck.t).toBe(GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE);
          });

          it('should carry a previously checked method forward when a later run is scoped to a different one', async () => {
            await runHealthCheck({ methods: [NotificationDeliveryMethod.NOTIFICATION_SUMMARY] });
            await passHealthCheckThrottleWindow();
            const { healthCheck } = await runHealthCheck({ methods: [NotificationDeliveryMethod.TEXT] });

            // the stored check should stay a complete picture rather than shrinking to the last request
            expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT)).toBeDefined();
            expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.NOTIFICATION_SUMMARY)).toBeDefined();
          });

          it('should persist the health check to the NotificationUser', async () => {
            const { healthCheck } = await runHealthCheck();

            const notificationUser = await assertSnapshotData(nu.document);

            expect(notificationUser.hc).toBeDefined();
            expect(notificationUser.hc?.s).toBe(healthCheck.s);
            expect(notificationUser.hc?.m.length).toBe(healthCheck.m.length);
            expect(notificationUser.hc?.at).toBeSameSecondAs(healthCheck.at);
          });

          it('should not dispatch a probe unless one is requested', async () => {
            const result = await runHealthCheck();

            expect(result.probesDispatched).toBe(0);
            expect(result.probesResolved).toBe(0);
            expect(notificationDeliveryHealthCheckResultForMethod(result.healthCheck, NotificationDeliveryMethod.TEXT)?.pr).toBeUndefined();
          });

          // PUSH's sendServiceConfigured is hard-coded false (notification.healthcheck.ts:291-298), so
          // SEND_SERVICE_NOT_CONFIGURED is the only branch it can ever reach — every other per-method
          // check returns early on it.
          it('should report that a delivery method with no send service configured is not enabled', async () => {
            const { healthCheck } = await runHealthCheck({ methods: [NotificationDeliveryMethod.PUSH] });

            const pushResult = notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.PUSH);

            expect(pushResult?.s).toBe(NotificationHealthCheckStatus.SKIPPED);
            expect(issueCodes(pushResult?.is ?? [])).toContain(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_NOT_CONFIGURED);
          });

          describe('run throttle', () => {
            itShouldFail('when a second run is made inside the throttle window', async () => {
              await runHealthCheck();

              await expectFail(() => runHealthCheck(), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_HEALTH_CHECK_THROTTLED_ERROR_CODE));
            });

            // the probe poll answers to its own window instead: watching an in-flight test message must
            // not spend the allowance for running the check itself
            it('should allow a verify-only run inside the run throttle window', async () => {
              await runHealthCheck();
              await passHealthCheckVerifyThrottleWindow();

              await expect(runHealthCheck({ verifyPendingProbesOnly: true })).resolves.toBeDefined();
            });

            // asserts state after the rejection, so it uses rejects.toThrow() rather than expectFail(),
            // which throws its own ExpectedFailError and would skip everything after it
            it('should leave the stored check untouched when a run is throttled', async () => {
              const { healthCheck } = await runHealthCheck();

              await expect(runHealthCheck()).rejects.toThrow();

              const notificationUser = await assertSnapshotData(nu.document);
              expect(notificationUser.hc?.at).toBeSameSecondAs(healthCheck.at);
            });

            it('should allow a run once the throttle window has passed', async () => {
              const first = await runHealthCheck();

              await passHealthCheckThrottleWindow();
              const second = await runHealthCheck();

              expect(second.healthCheck.at.getTime()).toBeGreaterThan(first.healthCheck.at.getTime());
            });

            it('should allow a run inside the throttle window when forced', async () => {
              const first = await runHealthCheck();

              const forced = await runHealthCheck({ force: true });

              expect(forced.healthCheck.at.getTime()).toBeGreaterThan(first.healthCheck.at.getTime());
            });
          });

          it('should report that the user is not subscribed to any notification boxes', async () => {
            const { healthCheck } = await runHealthCheck();

            expect(issueCodes(healthCheck.is)).toContain(KnownNotificationHealthCheckIssueCode.NO_NOTIFICATION_BOXES);
          });

          describe('with no phone number configured', () => {
            it('should report that there is no delivery target for text', async () => {
              const { healthCheck } = await runHealthCheck();

              const textResult = notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT);

              expect(textResult?.tg).toBeUndefined();
              expect(textResult?.s).toBe(NotificationHealthCheckStatus.ERROR);
              expect(issueCodes(textResult?.is ?? [])).toContain(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET);
            });
          });

          describe('with a phone number configured', () => {
            const t = '+12088888888';

            beforeEach(async () => {
              await updateNotificationUser({ dc: { t } });
            });

            it('should resolve the configured phone number as the delivery target', async () => {
              const { healthCheck } = await runHealthCheck();

              const textResult = notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT);

              expect(textResult?.tg).toBe(t);
              expect(issueCodes(textResult?.is ?? [])).not.toContain(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET);
            });

            it('should report that text is only sent to recipients who opted in', async () => {
              const { healthCheck } = await runHealthCheck();

              const textResult = notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT);

              // the send pipeline only texts explicitly-enabled recipients, so an unset config means no texts
              expect(issueCodes(textResult?.is ?? [])).toContain(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_TEMPLATE);
            });

            it('should not report an opt-in problem once text is turned on for the template type', async () => {
              await updateNotificationUser({ dc: { t, configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, st: true }] } });

              const { healthCheck } = await runHealthCheck();

              const textResult = notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT);

              expect(issueCodes(textResult?.is ?? [])).not.toContain(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_TEMPLATE);
            });

            it('should report the global config turning a method off as the decisive one', async () => {
              await updateNotificationUser({
                gc: { configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, st: false }] },
                dc: { t, configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, st: true }] }
              });

              const { healthCheck } = await runHealthCheck();

              const textResult = notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT);

              expect(textResult?.s).toBe(NotificationHealthCheckStatus.ERROR);
              expect(issueCodes(textResult?.is ?? [])).toContain(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_GLOBALLY);
            });
          });

          describe('when the user has opted out', () => {
            beforeEach(async () => {
              await updateNotificationUser({ gc: { f: NotificationBoxRecipientFlag.OPT_OUT } });
            });

            it('should report the opt-out once as an account-wide problem', async () => {
              const { healthCheck } = await runHealthCheck({ methods: [NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.NOTIFICATION_SUMMARY] });

              expect(healthCheck.s).toBe(NotificationHealthCheckStatus.ERROR);
              expect(issueCodes(healthCheck.is).filter((x) => x === KnownNotificationHealthCheckIssueCode.RECIPIENT_OPTED_OUT).length).toBe(1);

              // the account-wide finding is not repeated on each method
              healthCheck.m.forEach((methodResult) => {
                expect(issueCodes(methodResult.is)).not.toContain(KnownNotificationHealthCheckIssueCode.RECIPIENT_OPTED_OUT);
              });
            });
          });

          describe('verifyPendingProbesOnly', () => {
            it('should carry the previous findings forward without re-running the configuration checks', async () => {
              const first = await runHealthCheck();
              const firstTextIssues = issueCodes(notificationDeliveryHealthCheckResultForMethod(first.healthCheck, NotificationDeliveryMethod.TEXT)?.is ?? []);

              await passHealthCheckVerifyThrottleWindow();
              const second = await runHealthCheck({ verifyPendingProbesOnly: true });
              const secondTextIssues = issueCodes(notificationDeliveryHealthCheckResultForMethod(second.healthCheck, NotificationDeliveryMethod.TEXT)?.is ?? []);

              expect(secondTextIssues).toEqual(firstTextIssues);
              expect(issueCodes(second.healthCheck.is)).toEqual(issueCodes(first.healthCheck.is));
              expect(second.probesDispatched).toBe(0);
              expect(second.probesResolved).toBe(0);
            });

            // the client polls this while a test message is in flight, so it must not spend the run
            // allowance the user needs for the check itself
            it('should leave the run window where it was, advancing only the verification time', async () => {
              const first = await runHealthCheck();

              await passHealthCheckVerifyThrottleWindow();
              const second = await runHealthCheck({ verifyPendingProbesOnly: true });

              expect(second.healthCheck.at).toBeSameSecondAs(first.healthCheck.at);

              const { hc } = await assertSnapshotData(nu.document);
              expect(hc?.at).toBeSameSecondAs(first.healthCheck.at);
              expect(hc?.vat?.getTime()).toBeGreaterThan(first.healthCheck.at.getTime());
            });

            describe('verify throttle', () => {
              itShouldFail('when a verification is made inside the verify window', async () => {
                await runHealthCheck();

                await expectFail(() => runHealthCheck({ verifyPendingProbesOnly: true }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_HEALTH_CHECK_VERIFY_THROTTLED_ERROR_CODE));
              });

              it('should allow a verification once the verify window has passed', async () => {
                await runHealthCheck();
                await passHealthCheckVerifyThrottleWindow();

                await expect(runHealthCheck({ verifyPendingProbesOnly: true })).resolves.toBeDefined();
              });
            });
          });

          describe('when notifications are turned off for the recipient', () => {
            it('should report the global config flag as an account-wide problem', async () => {
              await updateNotificationUser({ gc: { f: NotificationBoxRecipientFlag.DISABLED } });

              const { healthCheck } = await runHealthCheck();
              const issue = issueForCode(healthCheck.is, KnownNotificationHealthCheckIssueCode.RECIPIENT_DISABLED);

              expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
              expect(issue?.d?.scope).toBe('global');
            });

            it('should report the default config flag as an account-wide problem', async () => {
              await updateNotificationUser({ dc: { f: NotificationBoxRecipientFlag.DISABLED } });

              const { healthCheck } = await runHealthCheck();
              const issue = issueForCode(healthCheck.is, KnownNotificationHealthCheckIssueCode.RECIPIENT_DISABLED);

              expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
              expect(issue?.d?.scope).toBe('default');
            });

            it('should report each disabled scope separately', async () => {
              await updateNotificationUser({ gc: { f: NotificationBoxRecipientFlag.DISABLED }, dc: { f: NotificationBoxRecipientFlag.DISABLED } });

              const { healthCheck } = await runHealthCheck();
              const disabledIssues = healthCheck.is.filter((x) => x.c === KnownNotificationHealthCheckIssueCode.RECIPIENT_DISABLED);

              expect(disabledIssues.map((x) => x.d?.scope)).toEqual(expect.arrayContaining(['global', 'default']));
            });
          });

          describe('when the user has notification box exclusions', () => {
            it('should report the exclusions as an account-wide warning', async () => {
              // written directly: the exclusion list is normally populated by the association sync
              await nu.document.update({ x: ['guestbook'] });

              const { healthCheck } = await runHealthCheck();
              const issue = issueForCode(healthCheck.is, KnownNotificationHealthCheckIssueCode.NOTIFICATION_BOX_EXCLUSIONS);

              expect(issue?.s).toBe(NotificationHealthCheckStatus.WARNING);
              expect(issue?.d?.exclusions).toEqual(['guestbook']);
            });
          });

          describe('when the user config has not finished syncing', () => {
            beforeEach(async () => {
              await nu.document.update({ ns: true });
            });

            it('should report NEEDS_CONFIG_SYNC without per-subscription detail', async () => {
              const { healthCheck } = await runHealthCheck();
              const issue = issueForCode(healthCheck.is, KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC);

              expect(issue?.s).toBe(NotificationHealthCheckStatus.WARNING);
              // the per-box variant carries d.notificationBoxIds; the user-level flag carries nothing
              expect(issue?.d).toBeUndefined();
            });

            it('should not report it when subscription checks are skipped', async () => {
              const { healthCheck } = await runHealthCheck({ skipSubscriptionChecks: true });

              expect(issueCodes(healthCheck.is)).not.toContain(KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC);
              // the account-wide and per-method checks still run
              expect(issueCodes(healthCheck.is)).toContain(KnownNotificationHealthCheckIssueCode.NO_NOTIFICATION_BOXES);
              expect(issueCodes(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT)?.is ?? [])).toContain(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET);
            });
          });

          describe('with a text delivery target', () => {
            const setTextHealthCheckService = (healthCheckService: NotificationTextSendServiceHealthCheckService) => setSendServiceHealthCheckService(f.notificationSendService.textSendService, healthCheckService);

            beforeEach(async () => {
              await updateNotificationUser({ dc: { t: TEST_PHONE_NUMBER } });
            });

            it('should report that a channel with no provider health check could not be verified', async () => {
              const { healthCheck } = await runHealthCheck();
              const textResult = notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT);
              const issue = issueForCode(textResult?.is ?? [], KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE);

              expect(issue?.s).toBe(NotificationHealthCheckStatus.SKIPPED);
              expect(issue?.d?.method).toBe(NotificationDeliveryMethod.TEXT);
              // there is nothing the user can do about a provider integration that does not exist
              expect(issue?.f).toBeUndefined();
            });

            it('should report a provider health check that threw as unknown rather than failing the check', async () => {
              setTextHealthCheckService({
                async runHealthCheck() {
                  throw new Error('provider unreachable');
                }
              });

              const { healthCheck } = await runHealthCheck();
              const textResult = notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT);
              const issue = issueForCode(textResult?.is ?? [], KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE);

              expect(issue?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);
              expect(issue?.d?.error).toContain('provider unreachable');
            });

            describe('probe accounting', () => {
              const probeId = 'probe-1';

              /**
               * A provider that dispatches a probe when asked to.
               */
              const dispatchingHealthCheckService: NotificationTextSendServiceHealthCheckService = {
                supportsProbe: true,
                async runHealthCheck({ sendProbe, now }) {
                  return { issues: [], probe: sendProbe ? { id: probeId, at: now, s: NotificationHealthCheckStatus.PENDING, tg: TEST_PHONE_NUMBER } : undefined };
                }
              };

              it('should count a newly dispatched probe', async () => {
                setTextHealthCheckService(dispatchingHealthCheckService);

                const result = await runHealthCheck({ sendProbe: true });

                expect(result.probesDispatched).toBe(1);
                expect(result.probesResolved).toBe(0);
                expect(notificationDeliveryHealthCheckResultForMethod(result.healthCheck, NotificationDeliveryMethod.TEXT)?.pr?.id).toBe(probeId);
              });

              // A dispatched test message settles on the provider's schedule, so a verification is what
              // turns it into a result. The client polls this on its own, which is why the report no
              // longer asks the user to come back and re-run the check.
              describe('resolving an in-flight probe', () => {
                it('should settle a pending probe on a verification, without a full run', async () => {
                  setTextHealthCheckService({
                    supportsProbe: true,
                    async runHealthCheck({ sendProbe, pendingProbe, now }) {
                      return {
                        issues: [],
                        probe: sendProbe ? { id: probeId, at: now, s: NotificationHealthCheckStatus.PENDING, tg: TEST_PHONE_NUMBER } : pendingProbe ? { ...pendingProbe, s: NotificationHealthCheckStatus.OK, d: 'Delivered' } : undefined
                      };
                    }
                  });

                  const dispatched = await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });
                  expect(dispatched.probesDispatched).toBe(1);

                  await passHealthCheckVerifyThrottleWindow();
                  const verified = await runHealthCheck({ verifyPendingProbesOnly: true, methods: [NotificationDeliveryMethod.TEXT] });

                  expect(verified.probesResolved).toBe(1);

                  // the outcome lands on the document, which is what the client renders from
                  const { hc } = await assertSnapshotData(nu.document);
                  expect(notificationDeliveryHealthCheckResultForMethod(hc, NotificationDeliveryMethod.TEXT)?.pr?.s).toBe(NotificationHealthCheckStatus.OK);
                });

                // what makes the verification cheap enough for the client to poll: with nothing in
                // flight it costs no provider calls at all
                it('should not consult the provider on a verification with nothing in flight', async () => {
                  let providerCalls = 0;

                  setTextHealthCheckService({
                    supportsProbe: true,
                    async runHealthCheck() {
                      providerCalls += 1;
                      return { issues: [] };
                    }
                  });

                  await runHealthCheck();
                  const callsAfterRun = providerCalls;

                  await passHealthCheckVerifyThrottleWindow();
                  await runHealthCheck({ verifyPendingProbesOnly: true });

                  expect(callsAfterRun).toBeGreaterThan(0);
                  expect(providerCalls).toBe(callsAfterRun);
                });
              });

              // The client derives the test message button's disabled state from the SAME stored probe
              // the server throttles on, so a dispatch that recorded nothing would leave the button live
              // and the call succeeding — one provider call per click.
              it('should throttle the method even when the dispatched probe could not be tracked', async () => {
                setTextHealthCheckService({
                  supportsProbe: true,
                  async runHealthCheck({ sendProbe, now }) {
                    // what a provider that accepted the send but returned no correlation id produces
                    return { issues: [], probe: sendProbe ? { id: '', at: now, s: NotificationHealthCheckStatus.UNKNOWN, tg: TEST_PHONE_NUMBER } : undefined };
                  }
                });

                const result = await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });

                expect(result.probesDispatched).toBe(1);
                // recorded, and settled rather than pending — there is no outcome coming for it
                const probe = notificationDeliveryHealthCheckResultForMethod(result.healthCheck, NotificationDeliveryMethod.TEXT)?.pr;
                expect(probe?.at).toBeDefined();
                expect(probe?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);

                // asserts state before the rejection, so it uses rejects.toThrow() rather than
                // expectFail(), which throws its own ExpectedFailError outside an itShouldFail
                await expect(runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] })).rejects.toThrow();
              });

              describe('probe throttle', () => {
                beforeEach(() => {
                  setTextHealthCheckService(dispatchingHealthCheckService);
                });

                it('should allow a test message inside the run throttle window', async () => {
                  // a run does not consume the test message allowance, so the probe window is what counts
                  await runHealthCheck();

                  const result = await runHealthCheck({ sendProbe: true });

                  expect(result.probesDispatched).toBe(1);
                });

                itShouldFail('when a second test message is requested inside the probe window', async () => {
                  await runHealthCheck({ sendProbe: true });

                  await expectFail(() => runHealthCheck({ sendProbe: true }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLED_ERROR_CODE));
                });

                it('should allow a test message once the probe window has passed', async () => {
                  await runHealthCheck({ sendProbe: true });
                  await passHealthCheckProbeThrottleWindow();

                  // a fresh id: probesDispatched only counts a probe that is not the one already stored
                  setTextHealthCheckService({
                    supportsProbe: true,
                    async runHealthCheck({ sendProbe, now }) {
                      return { issues: [], probe: sendProbe ? { id: 'probe-2', at: now, s: NotificationHealthCheckStatus.PENDING, tg: TEST_PHONE_NUMBER } : undefined };
                    }
                  });

                  const result = await runHealthCheck({ sendProbe: true });

                  expect(result.probesDispatched).toBe(1);
                });
              });

              // the probe window is per method, since each method has its own test message button
              describe('per-method probe throttle', () => {
                const summaryProbeId = 'summary-probe-1';

                /**
                 * A second probe-capable method, so a window on one method can be shown not to gate the
                 * other. The demo wires a notification summary send service plus a summary id for every
                 * uid, so this method has a delivery target without any further setup.
                 */
                const dispatchingSummaryHealthCheckService: NotificationSummarySendServiceHealthCheckService = {
                  supportsProbe: true,
                  async runHealthCheck({ sendProbe, target, now }) {
                    return { issues: [], probe: sendProbe ? { id: summaryProbeId, at: now, s: NotificationHealthCheckStatus.PENDING, tg: target } : undefined };
                  }
                };

                beforeEach(() => {
                  setTextHealthCheckService(dispatchingHealthCheckService);
                  setSendServiceHealthCheckService(f.notificationSendService.notificationSummarySendService, dispatchingSummaryHealthCheckService);
                });

                it('should dispatch a probe only for the requested method', async () => {
                  const result = await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });

                  expect(result.probesDispatched).toBe(1);
                  expect(notificationDeliveryHealthCheckResultForMethod(result.healthCheck, NotificationDeliveryMethod.TEXT)?.pr?.id).toBe(probeId);
                  expect(notificationDeliveryHealthCheckResultForMethod(result.healthCheck, NotificationDeliveryMethod.NOTIFICATION_SUMMARY)?.pr).toBeUndefined();
                });

                itShouldFail('when a second test message is requested on the same method inside its window', async () => {
                  await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });

                  await expectFail(() => runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLED_ERROR_CODE));
                });

                it('should allow a test message on a different method inside the first method window', async () => {
                  await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });

                  const result = await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.NOTIFICATION_SUMMARY] });

                  expect(result.probesDispatched).toBe(1);
                  expect(notificationDeliveryHealthCheckResultForMethod(result.healthCheck, NotificationDeliveryMethod.NOTIFICATION_SUMMARY)?.pr?.id).toBe(summaryProbeId);

                  // the text probe is carried forward rather than re-dispatched. Read from the document:
                  // a probe run returns only the method it probed, while the stored check stays complete
                  const { hc } = await assertSnapshotData(nu.document);
                  expect(notificationDeliveryHealthCheckResultForMethod(hc, NotificationDeliveryMethod.TEXT)?.pr?.id).toBe(probeId);
                });

                // the demo configures a longer probe window (5m) than run window (2m), so a check
                // backdated between the two proves the CONFIGURED probe window is what is enforced
                // rather than the library default
                itShouldFail('when a test message is requested inside the app-configured probe window', async () => {
                  await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });
                  await backdateHealthCheck(DEMO_NOTIFICATION_HEALTH_CHECK_RUN_THROTTLE_MINUTES + 1);

                  await expectFail(() => runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLED_ERROR_CODE));
                });

                it('should allow a plain run at a point the probe window still rejects a test message', async () => {
                  await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });
                  await backdateHealthCheck(DEMO_NOTIFICATION_HEALTH_CHECK_RUN_THROTTLE_MINUTES + 1);

                  // past the run window, still inside the probe window: the two are independent
                  await expect(runHealthCheck({ methods: [NotificationDeliveryMethod.TEXT] })).resolves.toBeDefined();
                });

                it('should allow a second test message on the same method when forced', async () => {
                  const first = await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });
                  expect(first.probesDispatched).toBe(1);

                  // a fresh id, so probesDispatched counts this as a new probe rather than the stored one
                  setTextHealthCheckService({
                    supportsProbe: true,
                    async runHealthCheck({ sendProbe, now }) {
                      return { issues: [], probe: sendProbe ? { id: 'probe-forced', at: now, s: NotificationHealthCheckStatus.PENDING, tg: TEST_PHONE_NUMBER } : undefined };
                    }
                  });

                  const forced = await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT], force: true });

                  expect(forced.probesDispatched).toBe(1);
                  expect(notificationDeliveryHealthCheckResultForMethod(forced.healthCheck, NotificationDeliveryMethod.TEXT)?.pr?.id).toBe('probe-forced');
                });

                itShouldFail('when an unscoped test message is requested inside any single method window', async () => {
                  await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });

                  // an unscoped run probes every capable method, so it answers to all of their windows
                  await expectFail(() => runHealthCheck({ sendProbe: true, methods: [] }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLED_ERROR_CODE));
                });
              });

              describe('returned health check scope', () => {
                beforeEach(() => {
                  setTextHealthCheckService(dispatchingHealthCheckService);
                  setSendServiceHealthCheckService(f.notificationSendService.notificationSummarySendService, {
                    supportsProbe: true,
                    async runHealthCheck({ sendProbe, target, now }) {
                      return { issues: [], probe: sendProbe ? { id: 'summary-probe-scope', at: now, s: NotificationHealthCheckStatus.PENDING, tg: target } : undefined };
                    }
                  } as NotificationSummarySendServiceHealthCheckService);
                });

                // A scoped run stores only the methods it checked plus whatever was already stored, so each
                // test below first runs a check covering TWO methods — otherwise a first scoped run's check
                // legitimately covers one method and proves nothing about narrowing. Both are local
                // methods; pulling email in would reach for Mailgun.
                const twoMethods = [NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.NOTIFICATION_SUMMARY];

                it('should return only the probed method for a test message run', async () => {
                  await runHealthCheck({ methods: twoMethods });

                  // a plain run does not consume the probe allowance, so this is not throttled
                  const { healthCheck } = await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });

                  expect(healthCheck.m.map((x) => x.me)).toEqual([NotificationDeliveryMethod.TEXT]);
                  // the account-wide findings are not what a test message call was about
                  expect(healthCheck.is).toEqual([]);
                });

                it('should still persist the complete check when the returned one is narrowed', async () => {
                  await runHealthCheck({ methods: twoMethods });

                  const { healthCheck } = await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT] });
                  expect(healthCheck.m.length).toBe(1);

                  const notificationUser = await assertSnapshotData(nu.document);

                  // the stored check keeps every method it has ever covered, plus the account-wide findings
                  expect(notificationUser.hc?.m.length).toBeGreaterThan(1);
                  expect(issueCodes(notificationUser.hc?.is ?? [])).toContain(KnownNotificationHealthCheckIssueCode.NO_NOTIFICATION_BOXES);
                });

                it('should return the complete check when it is explicitly requested', async () => {
                  await runHealthCheck({ methods: twoMethods });

                  const { healthCheck } = await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.TEXT], returnFullHealthCheck: true });

                  expect(healthCheck.m.length).toBeGreaterThan(1);
                  expect(issueCodes(healthCheck.is)).toContain(KnownNotificationHealthCheckIssueCode.NO_NOTIFICATION_BOXES);
                });

                it('should return the complete check for a plain run', async () => {
                  const { healthCheck } = await runHealthCheck({ methods: twoMethods });

                  expect(healthCheck.m.length).toBeGreaterThan(1);
                  expect(issueCodes(healthCheck.is)).toContain(KnownNotificationHealthCheckIssueCode.NO_NOTIFICATION_BOXES);
                });

                it('should return the complete check when nothing in scope could be probed', async () => {
                  // push has no send service at all, so a test message run has no narrower answer than the
                  // diagnosis explaining why nothing was sent — the account-wide findings survive
                  const { healthCheck } = await runHealthCheck({ sendProbe: true, methods: [NotificationDeliveryMethod.PUSH] });

                  expect(issueCodes(healthCheck.is)).toContain(KnownNotificationHealthCheckIssueCode.NO_NOTIFICATION_BOXES);
                });
              });

              describe('probe support', () => {
                it('should report a method whose provider can probe as testable', async () => {
                  setTextHealthCheckService(dispatchingHealthCheckService);

                  const { healthCheck } = await runHealthCheck({ methods: [NotificationDeliveryMethod.TEXT] });

                  expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT)?.pb).toBe(true);
                });

                it('should not report a method whose provider cannot probe as testable', async () => {
                  setTextHealthCheckService({
                    async runHealthCheck() {
                      return { issues: [] };
                    }
                  });

                  const { healthCheck } = await runHealthCheck({ methods: [NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.PUSH] });

                  // no supportsProbe on the provider, and no send service at all for push
                  expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT)?.pb).toBeUndefined();
                  expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.PUSH)?.pb).toBeUndefined();
                });
              });

              it('should count a pending probe the provider resolved on a later run', async () => {
                setTextHealthCheckService(dispatchingHealthCheckService);

                const first = await runHealthCheck({ sendProbe: true });
                expect(first.probesDispatched).toBe(1);

                // the second run resolves the same probe rather than sending another
                setTextHealthCheckService({
                  supportsProbe: true,
                  async runHealthCheck({ pendingProbe }) {
                    const probe: NotificationHealthCheckProbe = { ...pendingProbe!, s: NotificationHealthCheckStatus.OK, d: 'Delivered' };
                    return { issues: [], probe };
                  }
                });

                await passHealthCheckThrottleWindow();
                const second = await runHealthCheck();

                expect(second.probesResolved).toBe(1);
                expect(second.probesDispatched).toBe(0);
                expect(notificationDeliveryHealthCheckResultForMethod(second.healthCheck, NotificationDeliveryMethod.TEXT)?.pr?.s).toBe(NotificationHealthCheckStatus.OK);
              });
            });
          });

          // scoped to its own describe: a model test context registers its beforeEach in the enclosing
          // block, so creating the box out here would give every sibling test a subscription
          describe('with a notification box subscription', () => {
            demoNotificationBoxContext({ f, for: p, createIfNeeded: true }, (nb) => {
              beforeEach(async () => {
                // inserting the user as a box recipient is what gives them a bc entry to inspect
                await nb.updateRecipient({ uid: u.uid, insert: true });
              });

              it('should report a subscription that has not finished being set up', async () => {
                // createNotificationBox leaves s set until the box is initialized
                const { healthCheck } = await runHealthCheck();
                const issue = issueForCode(healthCheck.is, KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_NOT_READY);

                expect(issue?.s).toBe(NotificationHealthCheckStatus.WARNING);
                expect(issue?.d?.notificationBoxIds).toEqual([nb.documentId]);
              });

              it('should report a broken subscription instead of a not-ready one', async () => {
                await nb.document.update({ fi: true });

                const { healthCheck } = await runHealthCheck();
                const issue = issueForCode(healthCheck.is, KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_BROKEN);

                expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
                expect(issue?.d?.notificationBoxIds).toEqual([nb.documentId]);
                // a broken box is reported as broken only, even though it is also uninitialized
                expect(issueCodes(healthCheck.is)).not.toContain(KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_NOT_READY);
              });

              it('should report NEEDS_CONFIG_SYNC with the affected subscriptions when the box has no matching recipient', async () => {
                // drop the box's recipient entry, leaving the user's bc entry pointing at nothing
                await nb.document.update({ r: [] });

                const { healthCheck } = await runHealthCheck();
                const issue = issueForCode(healthCheck.is, KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC);

                expect(issue?.s).toBe(NotificationHealthCheckStatus.WARNING);
                expect(issue?.d?.notificationBoxIds).toEqual([nb.documentId]);
              });

              it('should report a delivery method switched off for one of the subscriptions', async () => {
                await nb.updateRecipient({ uid: u.uid, insert: true, configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, st: false }] });

                const { healthCheck } = await runHealthCheck();
                const textResult = notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT);
                const issue = issueForCode(textResult?.is ?? [], KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_BOX);

                expect(issue?.s).toBe(NotificationHealthCheckStatus.WARNING);
                expect(issue?.d?.notificationBoxIds).toEqual([nb.documentId]);
              });

              it('should drop every subscription finding when subscription checks are skipped', async () => {
                await nb.document.update({ fi: true });

                const { healthCheck } = await runHealthCheck({ skipSubscriptionChecks: true });
                const codes = issueCodes(healthCheck.is);

                expect(codes).not.toContain(KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_BROKEN);
                expect(codes).not.toContain(KnownNotificationHealthCheckIssueCode.SUBSCRIPTION_NOT_READY);
                expect(codes).not.toContain(KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC);
                // the per-method configuration checks still run
                expect(issueCodes(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT)?.is ?? [])).toContain(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET);
              });
            });
          });
        });

        // The caller has to keep a working auth record, so the account-level auth cases run as the
        // admin against a second user's NotificationUser. Scoped to its own describe so the second
        // user is not created for every other test in this file.
        describe('account-level auth findings', () => {
          demoAuthorizedUserContext({ f }, (u2) => {
            demoNotificationUserContext({ f, u: u2 }, (nu2) => {
              async function runHealthCheckForOtherUser(params?: Partial<NotificationUserHealthCheckParams>): Promise<NotificationUserHealthCheckResult> {
                const fullParams: NotificationUserHealthCheckParams = {
                  key: nu2.documentKey,
                  notificationTemplateType: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
                  methods: [NotificationDeliveryMethod.TEXT],
                  ...params
                };

                return u.callWrappedFunction(demoCallModelWrappedFn, onCallInvokeModelParams(notificationUserIdentity, fullParams, 'healthCheck')) as Promise<NotificationUserHealthCheckResult>;
              }

              it('should report a disabled sign-in account as an account-wide problem', async () => {
                await f.authService.userContext(u2.uid).updateUser({ disabled: true });

                const { healthCheck } = await runHealthCheckForOtherUser();
                const issue = issueForCode(healthCheck.is, KnownNotificationHealthCheckIssueCode.RECIPIENT_DISABLED);

                expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
                // no scope detail: this is the auth record, not one of the recipient config flags
                expect(issue?.d).toBeUndefined();
              });

              it('should stop after reporting that the sign-in account could not be read', async () => {
                await f.authService.auth.deleteUser(u2.uid);

                const { healthCheck } = await runHealthCheckForOtherUser();
                const issue = issueForCode(healthCheck.is, KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET);

                expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
                // nothing else can be determined without the auth record, so the remaining account
                // checks are skipped entirely
                expect(issueCodes(healthCheck.is)).not.toContain(KnownNotificationHealthCheckIssueCode.NO_NOTIFICATION_BOXES);
              });
            });
          });
        });
      });
    });
  });
});
