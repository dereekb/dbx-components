import { demoCallModel } from './../model/crud.functions';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoNotificationUserContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { type NotificationHealthCheckIssue, type NotificationUserHealthCheckParams, type NotificationUserHealthCheckResult, type UpdateNotificationUserParams, NotificationBoxRecipientFlag, NotificationDeliveryMethod, NotificationHealthCheckStatus, KnownNotificationHealthCheckIssueCode, notificationDeliveryHealthCheckResultForMethod, notificationUserIdentity, onCallInvokeModelParams, onCallUpdateModelParams } from '@dereekb/firebase';
import { GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';

/**
 * Reads the codes out of a set of issues, for order-independent assertions.
 */
function issueCodes(issues: NotificationHealthCheckIssue[]): string[] {
  return issues.map((x) => x.c);
}

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notificationUser.healthCheck', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserAdminContext({ f }, (u) => {
      demoProfileContext({ f, u }, () => {
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

          it('should return a health check for each requested delivery method', async () => {
            const { healthCheck } = await runHealthCheck({ methods: [NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.NOTIFICATION_SUMMARY] });

            expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.TEXT)).toBeDefined();
            expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.NOTIFICATION_SUMMARY)).toBeDefined();
            expect(healthCheck.at).toBeDefined();
            expect(healthCheck.t).toBe(GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE);
          });

          it('should carry a previously checked method forward when a later run is scoped to a different one', async () => {
            await runHealthCheck({ methods: [NotificationDeliveryMethod.NOTIFICATION_SUMMARY] });
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

          it('should report that a delivery method with no send service configured is not enabled', async () => {
            const { healthCheck } = await runHealthCheck({ methods: [NotificationDeliveryMethod.PUSH] });

            const pushResult = notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.PUSH);

            expect(pushResult?.s).toBe(NotificationHealthCheckStatus.SKIPPED);
            expect(issueCodes(pushResult?.is ?? [])).toContain(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_NOT_CONFIGURED);
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

              const second = await runHealthCheck({ verifyPendingProbesOnly: true });
              const secondTextIssues = issueCodes(notificationDeliveryHealthCheckResultForMethod(second.healthCheck, NotificationDeliveryMethod.TEXT)?.is ?? []);

              expect(secondTextIssues).toEqual(firstTextIssues);
              expect(issueCodes(second.healthCheck.is)).toEqual(issueCodes(first.healthCheck.is));
              expect(second.probesDispatched).toBe(0);
              expect(second.probesResolved).toBe(0);
            });
          });
        });
      });
    });
  });
});
