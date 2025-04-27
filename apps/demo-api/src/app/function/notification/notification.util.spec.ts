import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext, demoNotificationBoxContext, demoNotificationContext, demoNotificationSummaryContext, demoNotificationUserContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { Notification, NotificationBox, NotificationBoxRecipient, NotificationBoxRecipientFlag, NotificationBoxRecipientTemplateConfigArrayEntryParam, NotificationRecipientSendFlag, NotificationSendState, NotificationSendType, UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams, firestoreDummyKey, firestoreModelKey, twoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID, EXAMPLE_NOTIFICATION_TEMPLATE_TYPE, GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE, profileIdentity } from 'demo-firebase';
import { expandNotificationRecipients } from '@dereekb/firebase-server/model';
import { assertSnapshotData } from '@dereekb/firebase-server';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notification.util', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f, addContactInfo: true }, (u) => {
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
                  notificationUserAccessor: f.demoFirestoreCollections.notificationUserCollection.documentAccessor(),
                  notificationSummaryIdForUid: undefined
                });

                expect(result.notificationSummaries).toHaveLength(1);
                expect(result.notificationSummaries[0].boxRecipient).toBeDefined();
                expect(result.notificationSummaries[0].notificationSummaryId).toBe(notificationSummaryId);
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
                expect(uidSummary.notificationSummaryId).toBe(DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID(uid));

                expect(summaryIdSummary.boxRecipient).toBeDefined();
                expect(summaryIdSummary.notificationSummaryId).toBe(notificationSummaryId);
              });
            });
          });

          describe('scenarios', () => {
            describe('Example Notification', () => {
              demoNotificationBoxContext({ f, for: p, createIfNeeded: true, initIfNeeded: true }, (nb_p) => {
                describe('Notification Message Send Test', () => {
                  beforeEach(async () => {
                    const createInstance = await f.profileServerActions.createTestNotification({});
                    await createInstance(p.document);
                  });

                  demoNotificationContext(
                    {
                      f,
                      doc: async () => {
                        const notifications = await nb_p.loadAllNotificationsForNotificationBox();
                        return notifications[0].document;
                      }
                    },
                    (nbn) => {
                      it('should send a notifications', async () => {
                        const result = await nbn.sendNotification({});
                        expect(result.success).toBe(true);
                        expect(result.sendNotificationSummaryResult).toBeDefined();
                        expect(result.sendNotificationSummaryResult?.success).toHaveLength(1);
                      });
                    }
                  );
                });

                describe('Notification Message Dont Send Test', () => {
                  beforeEach(async () => {
                    const createInstance = await f.profileServerActions.createTestNotification({ skipSend: true });
                    await createInstance(p.document);
                  });

                  demoNotificationContext(
                    {
                      f,
                      doc: async () => {
                        const notifications = await nb_p.loadAllNotificationsForNotificationBox();
                        return notifications[0].document;
                      }
                    },
                    (nbn) => {
                      it('should not send any notifications', async () => {
                        const result = await nbn.sendNotification({});
                        expect(result.success).toBe(true);
                        expect(result.sendNotificationSummaryResult).toBeUndefined();
                      });
                    }
                  );
                });
              });
            });

            describe('Guestbook Scenario', () => {
              demoGuestbookContext({ f }, (g) => {
                demoNotificationBoxContext(
                  {
                    f,
                    for: g, // NotificationBox is for the guestbook
                    createIfNeeded: true,
                    initIfNeeded: true
                  },
                  (nb) => {
                    describe('Guestbook Entry', () => {
                      /**
                       * The guestbookEntryLikedNotificationTemplate() adds the recipient of the GuestbookEntry that only recieves notification summaries by default
                       */
                      describe('Guestbook Entry Likes Notifications', () => {
                        demoGuestbookEntryContext({ f, u, g, init: true }, (ge) => {
                          beforeEach(async () => {
                            await nb.deleteAllNotificationsForNotificationBox(); // delete all non-like notifications
                            await ge.like();
                          });

                          describe('notification user exists', () => {
                            demoNotificationUserContext({ f, u, init: true }, (nu) => {
                              demoNotificationSummaryContext({ f, for: p, createIfNeeded: true, initIfNeeded: true }, (ns_p) => {
                                demoNotificationContext(
                                  {
                                    f,
                                    doc: async () => {
                                      const notifications = await nb.loadAllNotificationsForNotificationBox();
                                      return notifications[0].document;
                                    }
                                  },
                                  (nbn) => {
                                    interface LikeNotificationShouldBeSentExpectation {
                                      readonly email: boolean;
                                      readonly text: boolean; // no text provider is configured for demo-api, but will still check expandNotificationRecipients()
                                      readonly notificationSummary: boolean;
                                      readonly checkGlobalConfig?: boolean;
                                      readonly checkDefaultConfig?: boolean;
                                      readonly checkOptOutFromFlag?: boolean;
                                    }

                                    function describeNotificationShouldBeSentToUser(expectation: LikeNotificationShouldBeSentExpectation) {
                                      it('should send the expected notifications to the user', async () => {
                                        let [notificationBox, notification] = await Promise.all([assertSnapshotData(nb.document), assertSnapshotData(nbn.document)]);

                                        expect(notification.es).toBe(NotificationSendState.QUEUED);
                                        expect(notification.ts).toBe(NotificationSendState.QUEUED);
                                        expect(notification.ps).toBe(NotificationSendState.QUEUED);
                                        expect(notification.ns).toBe(NotificationSendState.QUEUED);

                                        expect(notificationBox.r).toHaveLength(0); // no recipients in the box
                                        expect(notification.r).toHaveLength(1); // should have one recipient, the person who created the guestbook entry
                                        expect(notification.r[0].uid).toBe(u.uid);
                                        expect(notification.r[0].s).toBeUndefined();

                                        const result = await nbn.sendNotification({});

                                        expect(result.tryRun).toBe(true);

                                        expect(result.sendEmailsResult?.failed.length).toBeFalsy();
                                        expect(result.sendTextsResult?.failed.length).toBeFalsy();
                                        expect(result.sendNotificationSummaryResult?.failed.length).toBeFalsy();

                                        expect(result.sendEmailsResult?.success.length).toBe(expectation.email ? 1 : undefined);
                                        expect(result.sendTextsResult?.ignored.length).toBe(expectation.text ? 1 : undefined); // no text provider is configured for demo-api, so we check ignored
                                        expect(result.sendNotificationSummaryResult?.success.length).toBe(expectation.notificationSummary ? 1 : undefined);

                                        expect(result.success).toBe(true);

                                        if (expectation.notificationSummary) {
                                          const notificationSummary = await assertSnapshotData(ns_p.document);

                                          expect(notificationSummary.lat).toBeDefined();
                                          expect(notificationSummary.lat).toBeBefore(new Date());
                                          expect(notificationSummary.n).toHaveLength(1);
                                        }

                                        notification = await assertSnapshotData(nbn.document);
                                        expect(notification.d).toBe(true);

                                        expect(notification.ts).toBe(NotificationSendState.SENT);
                                        expect(notification.es).toBe(NotificationSendState.SENT);
                                        // expect(notification.ps).toBe(NotificationSendState.QUEUED);
                                        expect(notification.ns).toBe(NotificationSendState.SENT);
                                      });

                                      describe('expandNotificationRecipients()', () => {
                                        it('should expand the user recipient', async () => {
                                          const [notificationBox, notification] = await Promise.all([assertSnapshotData(nb.document), assertSnapshotData(nbn.document)]);

                                          expect(notificationBox.r).toHaveLength(0); // no recipients in the box
                                          expect(notification.r).toHaveLength(1); // should have one recipient, the person who created the guestbook entry
                                          expect(notification.r[0].uid).toBe(u.uid);

                                          const result = await expandNotificationRecipients({
                                            notification,
                                            notificationBox,
                                            authService: f.authService,
                                            notificationUserAccessor: f.demoFirestoreCollections.notificationUserCollection.documentAccessor(),
                                            notificationSummaryIdForUid: f.notificationSendService.notificationSummaryIdForUidFunction,
                                            onlySendToExplicitlyEnabledRecipients: notification.ois,
                                            onlyTextExplicitlyEnabledRecipients: notification.ots
                                          });

                                          expect(result._internal.globalRecipients).toHaveLength(0);
                                          expect(result._internal.explicitRecipients).toHaveLength(1);
                                          expect(result._internal.allBoxRecipientConfigs).toHaveLength(0);

                                          const explicitRecipient = result._internal.explicitRecipients[0];
                                          expect(explicitRecipient.uid).toBeDefined();
                                          expect(explicitRecipient.n).toBeUndefined();
                                          expect(explicitRecipient.s).toBeUndefined();
                                          expect(explicitRecipient.e).toBeUndefined();

                                          expect(Array.from(result._internal.nonNotificationBoxUidRecipientConfigs.keys())).toHaveLength(1);
                                          expect(Array.from(result._internal.notificationUserRecipientConfigs.entries())).toHaveLength(1);

                                          const notificationUser = await nu.document.snapshotData();
                                          expect(notificationUser).toBeDefined();

                                          const userNotificationUserRecipientConfig = result._internal.notificationUserRecipientConfigs.get(u.uid);
                                          expect(userNotificationUserRecipientConfig).toBeDefined();

                                          if (expectation.checkOptOutFromFlag) {
                                            expect(result._internal.otherNotificationUserUidOptOuts).toContain(u.uid);
                                          } else {
                                            // when not opt-out from all, the user details should be made available
                                            const authUser = result._internal.userDetailsMap.get(u.uid);
                                            expect(authUser).toBeDefined();
                                            expect(authUser?.email).toBeDefined();
                                            expect(authUser?.phoneNumber).toBeDefined();
                                          }

                                          if (userNotificationUserRecipientConfig) {
                                            const userGlobalConfig = notificationUser?.gc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE];
                                            const userDefaultConfig = notificationUser?.dc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE];
                                            const userNotificationUserRecipientConfigForTemplateType = userNotificationUserRecipientConfig.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE];

                                            // email is opt-in, so it should appear in the configuration
                                            if (expectation.email) {
                                              if (expectation.checkGlobalConfig) {
                                                expect(userGlobalConfig?.se).toBe(true);
                                              } else if (expectation.checkDefaultConfig) {
                                                expect(userDefaultConfig?.se).toBe(true);
                                              }

                                              expect(userNotificationUserRecipientConfigForTemplateType?.se).toBe(true);
                                            } else {
                                              if (expectation.checkGlobalConfig) {
                                                expect(userGlobalConfig?.se).toBeFalsy();
                                              } else if (expectation.checkDefaultConfig) {
                                                expect(userDefaultConfig?.se).toBeFalsy();
                                              }

                                              expect(userNotificationUserRecipientConfigForTemplateType?.se).toBeFalsy();
                                            }

                                            // text is opt-in, so it should appear in the configuration
                                            if (expectation.text) {
                                              if (expectation.checkGlobalConfig) {
                                                expect(userGlobalConfig?.st).toBe(true);
                                              } else if (expectation.checkDefaultConfig) {
                                                expect(userDefaultConfig?.st).toBe(true);
                                              }

                                              expect(userNotificationUserRecipientConfigForTemplateType?.st).toBe(true);
                                            } else {
                                              if (expectation.checkGlobalConfig) {
                                                expect(userGlobalConfig?.st).toBeFalsy();
                                              } else if (expectation.checkDefaultConfig) {
                                                expect(userDefaultConfig?.st).toBeFalsy();
                                              }

                                              expect(userNotificationUserRecipientConfigForTemplateType?.st).toBeFalsy();
                                            }
                                          }

                                          expect(result.emails).toHaveLength(expectation.email ? 1 : 0);
                                          expect(result.texts).toHaveLength(expectation.text ? 1 : 0);
                                          expect(result.notificationSummaries).toHaveLength(expectation.notificationSummary ? 1 : 0);

                                          if (expectation.notificationSummary) {
                                            expect(result.notificationSummaries[0].notificationSummaryId).toBe(DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID(u.uid));
                                          }
                                        });
                                      });
                                    }

                                    // Not associated with NotificationBox
                                    describe('user not associated with guestbook notification box', () => {
                                      describeNotificationShouldBeSentToUser({ email: false, text: false, notificationSummary: true });

                                      describe('global configuration', () => {
                                        function beforeEachUpdateNotificationUserGlobalConfig(gc: UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams) {
                                          beforeEach(async () => {
                                            await nu.updateNotificationUser({
                                              gc
                                            });
                                          });
                                        }

                                        function beforeEachUpdateNotificationUserGlobalConfigForTemplateType(config: Omit<NotificationBoxRecipientTemplateConfigArrayEntryParam, 'type'>) {
                                          beforeEachUpdateNotificationUserGlobalConfig({
                                            configs: [
                                              {
                                                type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
                                                ...config
                                              }
                                            ]
                                          });
                                        }

                                        describe('user opt in tests', () => {
                                          describe('user opts into sms', () => {
                                            beforeEachUpdateNotificationUserGlobalConfigForTemplateType({ st: true });
                                            describeNotificationShouldBeSentToUser({ email: false, text: true, notificationSummary: true, checkGlobalConfig: true });
                                          });

                                          describe('user opts into emails', () => {
                                            beforeEachUpdateNotificationUserGlobalConfigForTemplateType({ se: true });
                                            describeNotificationShouldBeSentToUser({ email: true, text: false, notificationSummary: true, checkGlobalConfig: true });
                                          });
                                        });

                                        describe('user opts out tests', () => {
                                          describe('partial opt-out', () => {
                                            // NOTE: effectively no effect since emails are disabled by default
                                            describe('user disables sending emails for Like notifications', () => {
                                              beforeEachUpdateNotificationUserGlobalConfigForTemplateType({ se: false });
                                              describeNotificationShouldBeSentToUser({ email: false, text: false, notificationSummary: true, checkGlobalConfig: true });
                                            });

                                            describe('user disables sending notification summaries for Like notifications', () => {
                                              beforeEachUpdateNotificationUserGlobalConfigForTemplateType({ sn: false });
                                              describeNotificationShouldBeSentToUser({ email: false, text: false, notificationSummary: false, checkGlobalConfig: true });
                                            });
                                          });

                                          describe('full opt-out', () => {
                                            describe('user has disabled sending for all Like notifications', () => {
                                              beforeEachUpdateNotificationUserGlobalConfigForTemplateType({ sd: false });
                                              describeNotificationShouldBeSentToUser({ email: false, text: false, notificationSummary: false, checkGlobalConfig: true });
                                            });

                                            describe('user has opted out of all notifications', () => {
                                              beforeEachUpdateNotificationUserGlobalConfig({
                                                f: NotificationBoxRecipientFlag.OPT_OUT
                                              });

                                              describeNotificationShouldBeSentToUser({ email: false, text: false, notificationSummary: false, checkOptOutFromFlag: true });
                                            });
                                          });
                                        });
                                      });

                                      describe('default configuration', () => {
                                        function beforeEachUpdateNotificationUserDefaultConfig(dc: UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams) {
                                          beforeEach(async () => {
                                            await nu.updateNotificationUser({
                                              dc
                                            });
                                          });
                                        }

                                        function beforeEachUpdateNotificationUserDefaultConfigForTemplateType(config: Omit<NotificationBoxRecipientTemplateConfigArrayEntryParam, 'type'>) {
                                          beforeEachUpdateNotificationUserDefaultConfig({
                                            configs: [
                                              {
                                                type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
                                                ...config
                                              }
                                            ]
                                          });
                                        }

                                        describe('user opt in tests', () => {
                                          describe('user opts into sms', () => {
                                            beforeEachUpdateNotificationUserDefaultConfigForTemplateType({ st: true });
                                            describeNotificationShouldBeSentToUser({ email: false, text: true, notificationSummary: true, checkDefaultConfig: true });
                                          });

                                          describe('user opts into emails', () => {
                                            beforeEachUpdateNotificationUserDefaultConfigForTemplateType({ se: true });
                                            describeNotificationShouldBeSentToUser({ email: true, text: false, notificationSummary: true, checkDefaultConfig: true });
                                          });

                                          describe('Notification opt-in', () => {
                                            // Opt-in send only
                                            describe('ois=true', () => {
                                              beforeEach(async () => {
                                                await nbn.document.update({ ois: true });
                                              });

                                              /**
                                               * This notification in particular opts-in the target user by default for notification summary
                                               */
                                              describe('user not opted in but is directly referenced as Notification recipient with notification summary enabled', () => {
                                                beforeEachUpdateNotificationUserDefaultConfigForTemplateType({ sd: null, se: null, st: null, sp: null, sn: null });
                                                describeNotificationShouldBeSentToUser({ email: false, text: false, notificationSummary: true, checkDefaultConfig: true });
                                              });
                                            });
                                          });
                                        });

                                        describe('user opts out tests', () => {
                                          describe('partial opt-out', () => {
                                            // NOTE: effectively no effect since emails are disabled by default
                                            describe('user disables sending emails for Like notifications', () => {
                                              beforeEachUpdateNotificationUserDefaultConfigForTemplateType({ se: false });
                                              describeNotificationShouldBeSentToUser({ email: false, text: false, notificationSummary: true, checkDefaultConfig: true });
                                            });

                                            describe('user disables sending notification summaries for Like notifications', () => {
                                              beforeEachUpdateNotificationUserDefaultConfigForTemplateType({ sn: false });
                                              describeNotificationShouldBeSentToUser({ email: false, text: false, notificationSummary: false, checkDefaultConfig: true });
                                            });
                                          });

                                          describe('full opt-out', () => {
                                            describe('user has disabled sending for all Like notifications', () => {
                                              beforeEachUpdateNotificationUserDefaultConfigForTemplateType({ sd: false });
                                              describeNotificationShouldBeSentToUser({ email: false, text: false, notificationSummary: false, checkDefaultConfig: true });
                                            });

                                            describe('user has opted out of all notifications', () => {
                                              beforeEachUpdateNotificationUserDefaultConfig({
                                                f: NotificationBoxRecipientFlag.OPT_OUT
                                              });

                                              describeNotificationShouldBeSentToUser({ email: false, text: false, notificationSummary: false, checkOptOutFromFlag: true });
                                            });
                                          });
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
