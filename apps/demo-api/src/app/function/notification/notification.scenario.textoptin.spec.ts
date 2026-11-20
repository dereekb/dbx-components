import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { demoCallModel } from './../model/crud.functions';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoNotificationUserContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { type NotificationTextOptInConfirmationFunction, type NotificationTextOptInConfirmationRequest, type NotificationTextSendService } from '@dereekb/firebase-server/model';
import { type UpdateNotificationUserParams, NotificationDeliveryMethod, notificationUserIdentity, onCallUpdateModelParams } from '@dereekb/firebase';
import { type TwilioIncomingMessagePayload, TwilioWebhookService } from '@dereekb/nestjs/twilio';
import { type E164PhoneNumber, type Maybe } from '@dereekb/util';
import { GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';

/**
 * Returns a random US phone number, so the opt-out queries (which match every NotificationUser with the number) don't match users from other tests.
 *
 * @returns A random E.164 phone number.
 */
function randomTestPhoneNumber(): E164PhoneNumber {
  return `+1208${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`;
}

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notificationUser text opt-in confirmation', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    let originalTextSendService: Maybe<NotificationTextSendService>;
    let sendTextOptInConfirmation: Mock<NotificationTextOptInConfirmationFunction>;

    function notificationSendService() {
      return f.notificationSendService as { textSendService?: Maybe<NotificationTextSendService> };
    }

    /**
     * Sends an incoming text through the app's Twilio webhook handlers, as if Twilio delivered it.
     *
     * @param payload - The incoming message fields to set.
     */
    async function receiveText(payload: Pick<TwilioIncomingMessagePayload, 'From' | 'Body'> & Partial<TwilioIncomingMessagePayload>): Promise<void> {
      const twilioWebhookService = f.nest.get(TwilioWebhookService);
      await twilioWebhookService.handler({ type: 'incoming', payload: { MessageSid: 'SM123', AccountSid: 'AC123', To: '+15555550456', NumMedia: 0, mediaUrls: [], raw: {}, ...payload } });
    }

    beforeEach(() => {
      sendTextOptInConfirmation = vi.fn<NotificationTextOptInConfirmationFunction>(async ({ to }) => ({ success: [to], failed: [], ignored: [] }));

      originalTextSendService = notificationSendService().textSendService;
      notificationSendService().textSendService = {
        async buildSendInstanceForTextNotificationMessages(messages) {
          return async () => ({ success: [], failed: [], ignored: messages.map((x) => x.inputContext.recipient.t as E164PhoneNumber) });
        },
        sendTextOptInConfirmation
      };
    });

    afterEach(() => {
      notificationSendService().textSendService = originalTextSendService;
    });

    demoAuthorizedUserAdminContext({ f }, (u) => {
      demoProfileContext({ f, u }, () => {
        demoNotificationUserContext({ f, u }, (nu) => {
          let phoneNumber: E164PhoneNumber;

          beforeEach(() => {
            phoneNumber = randomTestPhoneNumber();
          });

          async function updateNotificationUser(params: Omit<UpdateNotificationUserParams, 'key'>): Promise<void> {
            await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationUserIdentity, { key: nu.documentKey, ...params }));
          }

          async function optInToTexts(t: E164PhoneNumber = phoneNumber): Promise<void> {
            await updateNotificationUser({ gc: { t, configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, st: true }] } });
          }

          function confirmationsSentToUser(): NotificationTextOptInConfirmationRequest[] {
            return sendTextOptInConfirmation.mock.calls.map(([request]) => request).filter((x) => x.uid === u.uid);
          }

          it('should text a confirmation on the first opt-in with a number', async () => {
            await optInToTexts();

            expect(confirmationsSentToUser()).toEqual([{ uid: u.uid, to: phoneNumber }]);

            const notificationUser = await assertSnapshotData(nu.document);
            expect(notificationUser.gc.tcat).toBeDefined();
          });

          it('should not text a confirmation when saving a number without opting in to texts', async () => {
            await updateNotificationUser({ gc: { t: phoneNumber } });

            expect(confirmationsSentToUser()).toEqual([]);
          });

          it('should not text a confirmation when texts are disabled for the account', async () => {
            await updateNotificationUser({ gc: { t: phoneNumber, dm: [NotificationDeliveryMethod.TEXT], configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, st: true }] } });

            expect(confirmationsSentToUser()).toEqual([]);
          });

          it('should still save the opt-in when the confirmation fails', async () => {
            sendTextOptInConfirmation.mockRejectedValue(new Error('test confirmation failure'));

            await optInToTexts();

            expect(sendTextOptInConfirmation).toHaveBeenCalledTimes(1);

            const notificationUser = await assertSnapshotData(nu.document);
            expect(notificationUser.gc.t).toBe(phoneNumber);
            expect(notificationUser.gc.tcat).toBeDefined();
          });

          it('should save the opt-in with a text send service that sends no confirmations', async () => {
            notificationSendService().textSendService = originalTextSendService;
            expect(originalTextSendService?.sendTextOptInConfirmation).toBeUndefined();

            await optInToTexts();

            const notificationUser = await assertSnapshotData(nu.document);
            expect(notificationUser.gc.t).toBe(phoneNumber);
            expect(notificationUser.gc.tcat).toBeDefined();
          });

          describe('opted in', () => {
            beforeEach(async () => {
              await optInToTexts();
              expect(confirmationsSentToUser()).toEqual([{ uid: u.uid, to: phoneNumber }]);
              sendTextOptInConfirmation.mockClear();
            });

            it('should not text another confirmation when opting in to another type with the same number', async () => {
              await updateNotificationUser({ gc: { configs: [{ type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE, st: true }] } });

              expect(confirmationsSentToUser()).toEqual([]);
            });

            it('should text a confirmation to the new number when the number changes', async () => {
              const newPhoneNumber = randomTestPhoneNumber();
              await updateNotificationUser({ gc: { t: newPhoneNumber } });

              expect(confirmationsSentToUser()).toEqual([{ uid: u.uid, to: newPhoneNumber }]);
            });

            it('should not text a confirmation when the number changes after opting out of texts', async () => {
              await updateNotificationUser({ gc: { dm: [NotificationDeliveryMethod.TEXT] } });
              await updateNotificationUser({ gc: { t: randomTestPhoneNumber() } });

              expect(confirmationsSentToUser()).toEqual([]);
            });

            describe('stopped', () => {
              beforeEach(async () => {
                await receiveText({ From: phoneNumber, Body: 'STOP' });
              });

              it('should not text a confirmation when switching back to the stopped number', async () => {
                const newPhoneNumber = randomTestPhoneNumber();
                await updateNotificationUser({ gc: { t: newPhoneNumber } });
                expect(confirmationsSentToUser()).toEqual([{ uid: u.uid, to: newPhoneNumber }]);

                await updateNotificationUser({ gc: { t: phoneNumber } });

                expect(confirmationsSentToUser()).toEqual([{ uid: u.uid, to: newPhoneNumber }]);
                const notificationUser = await assertSnapshotData(nu.document);
                expect(notificationUser.gc.t).toBe(phoneNumber);
                expect(notificationUser.tso).toEqual([phoneNumber]);
              });

              it('should not text a confirmation on START, but should re-record consent', async () => {
                await receiveText({ From: phoneNumber, Body: 'START' });

                expect(sendTextOptInConfirmation).not.toHaveBeenCalled();

                const notificationUser = await assertSnapshotData(nu.document);
                expect(notificationUser.tso ?? []).toEqual([]);
                expect(notificationUser.gc.tcat).toBeDefined();
              });

              describe('another user', () => {
                demoAuthorizedUserContext({ f }, (u2) => {
                  demoNotificationUserContext({ f, u: u2 }, (nu2) => {
                    it('should not text a confirmation when saving a number another user stopped', async () => {
                      await nu2.updateNotificationUser({ gc: { t: phoneNumber, configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, st: true }] } });

                      expect(sendTextOptInConfirmation.mock.calls.filter(([x]) => x.uid === u2.uid)).toEqual([]);

                      const notificationUser = await assertSnapshotData(nu2.document);
                      expect(notificationUser.gc.t).toBe(phoneNumber);
                      expect(notificationUser.tso).toEqual([phoneNumber]);
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
