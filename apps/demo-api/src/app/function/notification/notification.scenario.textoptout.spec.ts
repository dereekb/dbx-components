import { demoCallModel } from './../model/crud.functions';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoNotificationUserContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { type NotificationUserHealthCheckParams, type NotificationUserHealthCheckResult, type UpdateNotificationUserParams, KnownNotificationHealthCheckIssueCode, NotificationDeliveryMethod, notificationUserIdentity, onCallInvokeModelParams, onCallUpdateModelParams } from '@dereekb/firebase';
import { type TwilioIncomingMessagePayload, TwilioOptOutType, TwilioWebhookService } from '@dereekb/nestjs/twilio';
import { type E164PhoneNumber } from '@dereekb/util';
import { GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';

/**
 * Returns a random US phone number, so the opt-out queries (which match every NotificationUser with the number) don't match users from other tests.
 *
 * @returns A random E.164 phone number.
 */
function randomTestPhoneNumber(): E164PhoneNumber {
  return `+1208${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`;
}

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notificationUser text opt-out', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    /**
     * Sends an incoming text through the app's Twilio webhook handlers, as if Twilio delivered it.
     *
     * @param payload - The incoming message fields to set.
     */
    async function receiveText(payload: Pick<TwilioIncomingMessagePayload, 'From' | 'Body'> & Partial<TwilioIncomingMessagePayload>): Promise<void> {
      const twilioWebhookService = f.nest.get(TwilioWebhookService);
      await twilioWebhookService.handler({ type: 'incoming', payload: { MessageSid: 'SM123', AccountSid: 'AC123', To: '+15555550456', NumMedia: 0, mediaUrls: [], raw: {}, ...payload } });
    }

    demoAuthorizedUserAdminContext({ f }, (u) => {
      demoProfileContext({ f, u }, () => {
        demoNotificationUserContext({ f, u }, (nu) => {
          let phoneNumber: E164PhoneNumber;

          async function updateNotificationUser(params: Omit<UpdateNotificationUserParams, 'key'>): Promise<void> {
            await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationUserIdentity, { key: nu.documentKey, ...params }));
          }

          beforeEach(async () => {
            phoneNumber = randomTestPhoneNumber();
            await updateNotificationUser({ gc: { t: phoneNumber, configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, st: true }] } });
          });

          describe('STOP', () => {
            it('should add the number when Twilio reports a STOP', async () => {
              await receiveText({ From: phoneNumber, Body: 'arrêt', OptOutType: TwilioOptOutType.STOP });

              const notificationUser = await assertSnapshotData(nu.document);
              expect(notificationUser.tso).toEqual([phoneNumber]);
            });

            it('should add the number for a STOP keyword without an OptOutType', async () => {
              await receiveText({ From: phoneNumber, Body: 'stop' });

              const notificationUser = await assertSnapshotData(nu.document);
              expect(notificationUser.tso).toEqual([phoneNumber]);
            });

            it('should not change anything for a text that is not a keyword', async () => {
              await receiveText({ From: phoneNumber, Body: 'Stop please' });

              const notificationUser = await assertSnapshotData(nu.document);
              expect(notificationUser.tso).toBeUndefined();
            });

            it('should not change anything for HELP', async () => {
              await receiveText({ From: phoneNumber, Body: 'HELP' });

              const notificationUser = await assertSnapshotData(nu.document);
              expect(notificationUser.tso).toBeUndefined();
            });

            it('should not change a different number', async () => {
              await receiveText({ From: randomTestPhoneNumber(), Body: 'STOP' });

              const notificationUser = await assertSnapshotData(nu.document);
              expect(notificationUser.tso).toBeUndefined();
            });

            describe('stopped', () => {
              beforeEach(async () => {
                await receiveText({ From: phoneNumber, Body: 'STOP' });
              });

              it('should report the stopped number in the health check', async () => {
                const params: NotificationUserHealthCheckParams = { key: nu.documentKey, notificationTemplateType: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, methods: [NotificationDeliveryMethod.TEXT] };
                const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallInvokeModelParams(notificationUserIdentity, params, 'healthCheck'))) as NotificationUserHealthCheckResult;

                const textResult = result.healthCheck.m.find((x) => x.me === NotificationDeliveryMethod.TEXT);
                const issueCodes = textResult?.is.map((x) => x.c);

                expect(issueCodes).toEqual([KnownNotificationHealthCheckIssueCode.TEXT_PHONE_NUMBER_STOPPED]);
                expect(textResult?.pb).toBeUndefined();
              });

              it('should ignore a tso in the update params', async () => {
                await updateNotificationUser({ tso: [], gc: { configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, se: true }] } } as Omit<UpdateNotificationUserParams, 'key'>);

                const notificationUser = await assertSnapshotData(nu.document);
                expect(notificationUser.tso).toEqual([phoneNumber]);
              });

              it('should not be cleared by an admin turning texts on', async () => {
                await updateNotificationUser({ gc: { dm: null, configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, st: true }] } });

                const notificationUser = await assertSnapshotData(nu.document);
                expect(notificationUser.tso).toEqual([phoneNumber]);
              });

              it('should clear the number and re-record consent on START', async () => {
                const before = await assertSnapshotData(nu.document);

                await receiveText({ From: phoneNumber, Body: 'START', OptOutType: TwilioOptOutType.START });

                const notificationUser = await assertSnapshotData(nu.document);
                expect(notificationUser.tso ?? []).toEqual([]);
                expect(notificationUser.gc.tcat).toBeDefined();

                if (before.gc.tcat != null) {
                  expect(notificationUser.gc.tcat?.getTime()).toBeGreaterThanOrEqual(before.gc.tcat.getTime());
                }
              });

              it('should still clear the old number on START after the texting number changed', async () => {
                const newPhoneNumber = randomTestPhoneNumber();
                await updateNotificationUser({ gc: { t: newPhoneNumber } });

                let notificationUser = await assertSnapshotData(nu.document);
                expect(notificationUser.gc.t).toBe(newPhoneNumber);
                expect(notificationUser.tso).toEqual([phoneNumber]);

                const tcatBefore = notificationUser.gc.tcat;
                await receiveText({ From: phoneNumber, Body: 'START' });

                notificationUser = await assertSnapshotData(nu.document);
                expect(notificationUser.tso ?? []).toEqual([]);
                expect(notificationUser.gc.tcat?.getTime()).toBe(tcatBefore?.getTime()); // consent is only re-recorded for the number being texted
              });

              describe('another user', () => {
                demoAuthorizedUserContext({ f }, (u2) => {
                  demoNotificationUserContext({ f, u: u2 }, (nu2) => {
                    it('should inherit the stop when saving the stopped number', async () => {
                      await nu2.updateNotificationUser({ gc: { t: phoneNumber } });

                      const notificationUser = await assertSnapshotData(nu2.document);
                      expect(notificationUser.gc.t).toBe(phoneNumber);
                      expect(notificationUser.tso).toEqual([phoneNumber]);
                    });

                    it('should clear the inherited stop on START', async () => {
                      await nu2.updateNotificationUser({ gc: { t: phoneNumber } });
                      await receiveText({ From: phoneNumber, Body: 'START' });

                      const [notificationUser, otherNotificationUser] = await Promise.all([assertSnapshotData(nu.document), assertSnapshotData(nu2.document)]);
                      expect(notificationUser.tso ?? []).toEqual([]);
                      expect(otherNotificationUser.tso ?? []).toEqual([]);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
