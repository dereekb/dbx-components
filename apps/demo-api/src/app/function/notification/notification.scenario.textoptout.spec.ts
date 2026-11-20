import { demoCallModel } from './../model/crud.functions';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoNotificationUserContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData, FirebaseServerAnalyticsService } from '@dereekb/firebase-server';
import { type NotificationUserHealthCheckParams, type NotificationUserHealthCheckResult, type UpdateNotificationUserParams, KnownNotificationHealthCheckIssueCode, NotificationDeliveryMethod, notificationUserIdentity, onCallInvokeModelParams, onCallUpdateModelParams } from '@dereekb/firebase';
import { type TwilioIncomingMessagePayload, TwilioOptOutType, TwilioWebhookService } from '@dereekb/nestjs/twilio';
import { type E164PhoneNumber, type Maybe } from '@dereekb/util';
import { type AnalyticsEventData } from '@dereekb/analytics';
import { GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';
import { DEMO_TEXT_KEYWORD_ANALYTICS_EVENT_NAME } from '../../api/twilio/twilio.analytics';

interface CapturedTextKeywordEvent {
  readonly uid: Maybe<string>;
  readonly data: AnalyticsEventData;
}

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

          describe('keyword analytics', () => {
            let captured: CapturedTextKeywordEvent[];
            let throwForUid: Maybe<string>;
            let analyticsService: FirebaseServerAnalyticsService;
            let originalSendEventData: FirebaseServerAnalyticsService['sendEventData'];

            beforeEach(() => {
              captured = [];
              throwForUid = undefined;

              analyticsService = f.nest.get(FirebaseServerAnalyticsService);
              originalSendEventData = analyticsService.sendEventData;
              const sendEventData = originalSendEventData.bind(analyticsService);

              analyticsService.sendEventData = (uid, name, data) => {
                if (name === DEMO_TEXT_KEYWORD_ANALYTICS_EVENT_NAME) {
                  if (uid != null && uid === throwForUid) {
                    throw new Error('test analytics failure');
                  }

                  captured.push({ uid, data });
                }

                sendEventData(uid, name, data);
              };
            });

            afterEach(() => {
              analyticsService.sendEventData = originalSendEventData;
            });

            it('should send a STOP event for the user', async () => {
              await receiveText({ From: phoneNumber, Body: 'STOP' });

              expect(captured).toEqual([{ uid: u.uid, data: { keyword: TwilioOptOutType.STOP } }]);
              expect(JSON.stringify(captured)).not.toContain(phoneNumber);
            });

            it('should send a START event for the user after a STOP', async () => {
              await receiveText({ From: phoneNumber, Body: 'STOP' });
              captured = [];

              await receiveText({ From: phoneNumber, Body: 'START' });

              expect(captured).toEqual([{ uid: u.uid, data: { keyword: TwilioOptOutType.START } }]);
            });

            it('should send a HELP event for the user without changing the opt-outs', async () => {
              await receiveText({ From: phoneNumber, Body: 'HELP' });

              expect(captured).toEqual([{ uid: u.uid, data: { keyword: TwilioOptOutType.HELP } }]);

              const notificationUser = await assertSnapshotData(nu.document);
              expect(notificationUser.tso).toBeUndefined();
            });

            it('should send no events when no NotificationUser has the number', async () => {
              const otherPhoneNumber = randomTestPhoneNumber();

              await receiveText({ From: otherPhoneNumber, Body: 'STOP' });
              await receiveText({ From: otherPhoneNumber, Body: 'HELP' });

              expect(captured).toEqual([]);
            });

            it('should send no events for a text that is not a keyword', async () => {
              await receiveText({ From: phoneNumber, Body: 'Stop please' });

              expect(captured).toEqual([]);
            });

            describe('another user with the same number', () => {
              demoAuthorizedUserContext({ f }, (u2) => {
                demoNotificationUserContext({ f, u: u2 }, (nu2) => {
                  beforeEach(async () => {
                    await nu2.updateNotificationUser({ gc: { t: phoneNumber } });
                  });

                  function capturedUidsFor(keyword: TwilioOptOutType): Maybe<string>[] {
                    return captured
                      .filter((x) => x.data['keyword'] === keyword)
                      .map((x) => x.uid)
                      .sort();
                  }

                  it('should send one event per user for STOP, HELP and START', async () => {
                    const expectedUids = [u.uid, u2.uid].sort();

                    await receiveText({ From: phoneNumber, Body: 'STOP' });
                    await receiveText({ From: phoneNumber, Body: 'HELP' });
                    await receiveText({ From: phoneNumber, Body: 'START' });

                    expect(captured.length).toBe(6);
                    expect(capturedUidsFor(TwilioOptOutType.STOP)).toEqual(expectedUids);
                    expect(capturedUidsFor(TwilioOptOutType.HELP)).toEqual(expectedUids);
                    expect(capturedUidsFor(TwilioOptOutType.START)).toEqual(expectedUids);
                  });

                  it('should contain a failed event and still send the event of the other user', async () => {
                    throwForUid = u.uid;

                    await receiveText({ From: phoneNumber, Body: 'STOP' });

                    const [notificationUser, otherNotificationUser] = await Promise.all([assertSnapshotData(nu.document), assertSnapshotData(nu2.document)]);
                    expect(notificationUser.tso).toEqual([phoneNumber]);
                    expect(otherNotificationUser.tso).toEqual([phoneNumber]);

                    expect(captured).toEqual([{ uid: u2.uid, data: { keyword: TwilioOptOutType.STOP } }]);
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
