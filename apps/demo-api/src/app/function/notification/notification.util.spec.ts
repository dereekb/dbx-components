import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext, demoNotificationBoxContext, demoNotificationUserContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { Notification, NotificationBox, NotificationBoxRecipient, NotificationRecipientSendFlag, NotificationSendState, NotificationSendType, firestoreDummyKey, firestoreModelKey, notificationSummaryIdentity, twoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { EXAMPLE_NOTIFICATION_TEMPLATE_TYPE, profileIdentity } from '@dereekb/demo-firebase';
import { expandNotificationRecipients } from '@dereekb/firebase-server/model';

demoApiFunctionContextFactory((f) => {
  describeCloudFunctionTest('notification.util', { f, fns: { demoCallModel } }, ({ demoCallModelCloudFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      demoProfileContext({ f, u }, (p) => {
        describe('expandNotificationRecipients()', () => {
          let baseNotification: Notification;

          beforeEach(async () => {
            baseNotification = {
              st: NotificationSendType.INIT_BOX_AND_SEND,
              n: {
                id: '0',
                cat: new Date(),
                t: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE
              },
              r: [],
              rf: NotificationRecipientSendFlag.NORMAL,
              sat: new Date(),
              a: 0,
              d: false,
              tsr: [],
              esr: [],
              ts: NotificationSendState.QUEUED,
              es: NotificationSendState.QUEUED,
              ps: NotificationSendState.QUEUED,
              ns: NotificationSendState.QUEUED
            };
          });

          describe('with NotificationBox', () => {
            const baseNotificationBox: NotificationBox = {
              cat: new Date(),
              m: firestoreDummyKey(),
              o: firestoreDummyKey(),
              r: [],
              w: 0
            };

            describe('notification summaries', () => {
              it('should not expand notification summaries for recipients with uids if notificationSummaryKeyForUid is not defined', async () => {
                const uid = 'a';
                const notificationSummaryId = twoWayFlatFirestoreModelKey(firestoreDummyKey());

                const notification: Notification = {
                  ...baseNotification
                };

                const r: NotificationBoxRecipient[] = [
                  {
                    uid,
                    i: 0,
                    c: {}
                  },
                  {
                    s: notificationSummaryId,
                    i: 0,
                    c: {}
                  }
                ];

                const notificationBox: NotificationBox = {
                  ...baseNotificationBox,
                  r
                };

                const result = await expandNotificationRecipients({
                  notification,
                  notificationBox,
                  authService: f.authService,
                  notificationUserAccessor: f.demoFirestoreCollections.notificationUserCollection.documentAccessor()
                });

                expect(result.notificationSummaries).toHaveLength(1);
                expect(result.notificationSummaries[0].boxRecipient).toBeDefined();
                expect(result.notificationSummaries[0].notificationSummaryKey).toBe(firestoreModelKey(notificationSummaryIdentity, notificationSummaryId));
              });

              it('should expand notification summaries for recipients with uids if notificationSummaryKeyForUid is defined', async () => {
                const uid = 'a';
                const notificationSummaryId = twoWayFlatFirestoreModelKey(firestoreDummyKey());

                const notification: Notification = {
                  ...baseNotification
                };

                const r: NotificationBoxRecipient[] = [
                  {
                    uid,
                    i: 0,
                    c: {}
                  },
                  {
                    s: notificationSummaryId,
                    i: 0,
                    c: {}
                  }
                ];

                const notificationBox: NotificationBox = {
                  ...baseNotificationBox,
                  r
                };

                const result = await expandNotificationRecipients({
                  notification,
                  notificationBox,
                  authService: f.authService,
                  notificationSummaryIdForUid: (x) => twoWayFlatFirestoreModelKey(firestoreModelKey(profileIdentity, x)),
                  notificationUserAccessor: f.demoFirestoreCollections.notificationUserCollection.documentAccessor()
                });

                expect(result.notificationSummaries).toHaveLength(2);

                const uidSummary = result.notificationSummaries[0];
                const summaryIdSummary = result.notificationSummaries[1];

                expect(uidSummary.boxRecipient).toBeDefined();
                expect(uidSummary.notificationSummaryKey).toBe(firestoreModelKey(notificationSummaryIdentity, twoWayFlatFirestoreModelKey(firestoreModelKey(profileIdentity, uid))));

                expect(summaryIdSummary.boxRecipient).toBeDefined();
                expect(summaryIdSummary.notificationSummaryKey).toBe(firestoreModelKey(notificationSummaryIdentity, notificationSummaryId));
              });
            });
          });

          describe('scenarios', () => {
            describe('Guestbook Scenario', () => {
              demoGuestbookContext({ f }, (g) => {
                demoNotificationBoxContext(
                  {
                    f,
                    for: g, // NotificationBox is for the guestbook
                    createIfNeeded: true
                  },
                  (nb) => {
                    describe('Guestbook Entry', () => {
                      describe('Guestbook Entry Likes Notifications', () => {
                        demoGuestbookEntryContext({ f, u, g, init: false }, (ge) => {
                          describe('notification user exists', () => {
                            demoNotificationUserContext({ f, u }, (nu) => {
                              beforeEach(async () => {
                                // TODO: Update NotificationUser...
                              });

                              describe('user has opted out of like notifications', () => {
                                it('should not return th');
                              });
                            });
                          });

                          describe('notification user does not exist', () => {});
                        });
                      });
                    });
                  }
                );
              });
            });
          });
        });
      });
    });
  });
});
