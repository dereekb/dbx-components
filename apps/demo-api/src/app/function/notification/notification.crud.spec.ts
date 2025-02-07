import { demoCallModel } from './../model/crud.functions';
import { addMinutes, isFuture } from 'date-fns';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoNotificationBoxContext, demoNotificationContext, demoProfileContext } from '../../../test/fixture';
import { describeCloudFunctionTest, jestExpectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { DocumentDataWithIdAndKey, NotificationBox, Notification, NotificationDocument, NotificationItem, NotificationMessage, NotificationMessageFunctionFactoryConfig, NotificationMessageInputContext, NotificationRecipientSendFlag, NotificationSendState, NotificationSendType, firestoreDummyKey, NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE, NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE } from '@dereekb/firebase';
import { demoNotificationTestFactory } from '../../common/model/notification/notification.factory';
import { TEST_NOTIFICATIONS_TEMPLATE_TYPE } from '@dereekb/demo-firebase';
import { createNotificationInTransactionFactory, CreateNotificationInTransactionParams, UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS } from '@dereekb/firebase-server/model';
import { demoNotificationMailgunSendService } from '../../common/model/notification/notification.send.mailgun.service';
import { expectFail, itShouldFail } from '@dereekb/util/test';

demoApiFunctionContextFactory((f) => {
  describeCloudFunctionTest('notification.crud', { f, fns: { demoCallModel } }, ({ demoCallModelCloudFn }) => {
    // TODO: Before each, replace the notification sender config, or reference a specific test type that can "test send" things.

    afterEach(() => {
      // f.mailgunService.mailgunApi.config.messages.sendTestEmails = false; // reset to prevent sending test emails by accident
    });

    describe('utils', () => {
      describe('buildNotificationMailgunTemplateEmailRequest()', () => {
        it('should build a template request for a known/registered template type', async () => {
          const testNotificationFactory = demoNotificationTestFactory(f.serverActionsContext);

          const item: NotificationItem = {
            id: 'test',
            cat: new Date(),
            t: TEST_NOTIFICATIONS_TEMPLATE_TYPE
          };

          // the test factory does not use these, but they are required for the config usually
          const notificationBox: DocumentDataWithIdAndKey<NotificationBox> = {} as any;
          const notification: DocumentDataWithIdAndKey<Notification> = {} as any;

          const config: NotificationMessageFunctionFactoryConfig = {
            item,
            notification,
            notificationBox
          };

          const inputContext: NotificationMessageInputContext = {
            recipient: {
              n: 'tester',
              e: 'test.sender@dereekb.com'
            }
          };

          const testFactory = await testNotificationFactory.factory(config);
          const notificationMessage = await testFactory(inputContext);

          const mailgunService = f.mailgunService;
          expect(mailgunService).toBeDefined();
          expect(mailgunService.mailgunApi).toBeDefined();

          const messages: NotificationMessage<{}>[] = [notificationMessage];

          const sendService = demoNotificationMailgunSendService(f.mailgunService);
          const send = await sendService.buildSendInstanceForEmailNotificationMessages(messages);

          expect(send).toBeDefined();
        });

        // TODO: it should fail
      });
    });

    describe('model', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        // use profile as the primary notification model target
        demoProfileContext({ f, u }, (p) => {
          describe('Notification Box', () => {
            describe('exists', () => {
              demoNotificationBoxContext(
                {
                  f,
                  for: p, // NotificationBox is for the profile
                  createIfNeeded: true
                },
                (nb) => {
                  describe('updateNotificationBoxRecipient()', () => {
                    describe('recipient with uid', () => {
                      demoAuthorizedUserContext({ f }, (u2) => {
                        it('should add a user recipient via uid of a user that exists', async () => {
                          let notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(0);

                          await nb.updateRecipient({
                            uid: u2.uid,
                            insert: true
                          });

                          notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(1);
                          expect(notificationBox.r[0].uid).toBe(u2.uid);
                        });

                        itShouldFail('if the recipient does not exist in the NotificationBox and insert is not true', async () => {
                          await expectFail(
                            () =>
                              nb.updateRecipient({
                                uid: u2.uid,
                                insert: false
                              }),
                            jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE)
                          );
                        });

                        itShouldFail('if the recipient with the target uid does not exist', async () => {
                          await expectFail(
                            () =>
                              nb.updateRecipient({
                                uid: 'does_not_exist',
                                insert: true
                              }),
                            jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE)
                          );
                        });
                      });
                    });

                    describe('recipient with email address', () => {
                      const e = 'tester@dereekb.com';

                      it('should add an email recipient', async () => {
                        let notificationBox = await assertSnapshotData(nb.document);
                        expect(notificationBox.r).toHaveLength(0);

                        await nb.updateRecipient({
                          e,
                          insert: true
                        });

                        notificationBox = await assertSnapshotData(nb.document);
                        expect(notificationBox.r).toHaveLength(1);
                        expect(notificationBox.r[0].e).toBe(e);
                      });

                      describe('one exists', () => {
                        const i = 0;

                        beforeEach(async () => {
                          await nb.updateRecipient({
                            e,
                            insert: true
                          });
                        });

                        it('should add two of the same email recipient if insert is true and no index is passed', async () => {
                          let notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(1);
                          expect(notificationBox.r[0].e).toBe(e);

                          // NOTE: Does not check for duplicate recipients. This is an intended effect.
                          await nb.updateRecipient({
                            e,
                            insert: true
                          });

                          notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(2);
                          expect(notificationBox.r[0].e).toBe(e);
                          expect(notificationBox.r[1].e).toBe(e);
                        });

                        it('should update the email of the target recipient', async () => {
                          let notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(1);
                          expect(notificationBox.r[0].e).toBe(e);
                          expect(notificationBox.r[0].i).toBe(i);

                          const expectedE = 'second@components.dereekb.com';

                          await nb.updateRecipient({
                            i,
                            e: expectedE
                          });

                          notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(1);
                          expect(notificationBox.r[0].e).toBe(expectedE);
                          expect(notificationBox.r[0].i).toBe(i);
                        });

                        it('should add a valid uid to the target recipient', async () => {
                          let notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(1);
                          expect(notificationBox.r[0].e).toBe(e);
                          expect(notificationBox.r[0].i).toBe(i);

                          const expectedE = 'second@components.dereekb.com';

                          await nb.updateRecipient({
                            i,
                            e: expectedE
                          });

                          notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(1);
                          expect(notificationBox.r[0].e).toBe(expectedE);
                          expect(notificationBox.r[0].i).toBe(i);
                        });

                        itShouldFail('to add a uid to the recipient if the target uid does not exist', async () => {
                          await expectFail(
                            () =>
                              nb.updateRecipient({
                                uid: 'does_not_exist',
                                insert: true
                              }),
                            jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE)
                          );
                        });

                        it('should remove the recipient', async () => {
                          await nb.updateRecipient({
                            i,
                            remove: true
                          });

                          const notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(0);
                        });
                      });
                    });
                  });

                  describe('created but not initialized', () => {
                    // TODO: ...
                  });
                }
              );
            });

            // If the box isn't initialized tben wait until it is before sending the first notifications
            describe('does not exist', () => {
              demoNotificationBoxContext(
                {
                  f,
                  for: p, // NotificationBox is for the profile
                  createIfNeeded: false
                },
                (nb) => {
                  let createNotificationInTransaction: ReturnType<typeof createNotificationInTransactionFactory>;

                  beforeEach(() => {
                    createNotificationInTransaction = createNotificationInTransactionFactory(f.serverActionsContextWithNotificationServices);
                  });

                  describe('creating a notification', () => {
                    describe('createNotificationInTransactionFactory()', () => {
                      it('should allow creating a notification without a NotificationBox existing, and does not create a NotificationBox when created.', async () => {
                        let notificationBoxExists = await nb.document.exists();
                        expect(notificationBoxExists).toBe(false);

                        const sendAt = addMinutes(new Date(), 3);
                        const d = {
                          test: true
                        };

                        const createParams: CreateNotificationInTransactionParams = {
                          createFor: p.document,
                          recipientSendFlag: NotificationRecipientSendFlag.SKIP_NOTIFICATION_BOX_RECIPIENTS,
                          sendType: NotificationSendType.INIT_BOX_AND_SEND,
                          sendAt,
                          item: {
                            m: firestoreDummyKey(),
                            s: 'test',
                            g: 'test',
                            t: 'TEST_TYPE',
                            d
                          }
                        };

                        const createdNotificationDocumentRef = await f.demoFirestoreCollections.firestoreContext.runTransaction(async (transaction) => {
                          const result = await createNotificationInTransaction(createParams, transaction);
                          return result.documentRef;
                        });

                        const notificationDocument = f.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocument(createdNotificationDocumentRef);
                        const notification = await assertSnapshotData(notificationDocument);

                        expect(notification.a).toBe(0);
                        expect(notification.d).toBe(false);
                        expect(notification.st).toBe(createParams.sendType);
                        expect(notification.r.length).toBe(0);
                        expect(notification.rf).toBe(createParams.recipientSendFlag);
                        expect(notification.sat).toBeSameSecondAs(sendAt);
                        expect(notification.n).toBeDefined();
                        expect(notification.n.cat).toBeDefined();
                        expect(notification.n.id).toBe(notificationDocument.id);
                        expect(notification.n.s).toBe(createParams.item.s);
                        expect(notification.n.g).toBe(createParams.item.g);
                        expect(notification.n.t).toBe(createParams.item.t);
                        expect(notification.n.m).toBe(createParams.item.m);
                        expect(notification.n.d).toBeDefined();
                        expect((notification.n.d as typeof d).test).toBe(d.test);
                        expect(notification.ts).toBe(NotificationSendState.QUEUED);
                        expect(notification.es).toBe(NotificationSendState.QUEUED);
                        expect(notification.ps).toBe(NotificationSendState.QUEUED);

                        // still does not exist
                        notificationBoxExists = await nb.document.exists();
                        expect(notificationBoxExists).toBe(false);

                        // should match
                        expect(notificationDocument.parent.path).toBe(nb.documentKey);
                      });
                    });
                  });

                  describe('Notification', () => {
                    let notificationDocument: NotificationDocument;

                    function initNotification(sendType: NotificationSendType, loadParams?: () => Partial<CreateNotificationInTransactionParams>) {
                      beforeEach(async () => {
                        const partialParams = await loadParams?.();

                        const createParams: CreateNotificationInTransactionParams = {
                          createFor: p.document,
                          sendType,
                          item: {
                            s: 'test',
                            g: 'test',
                            ...partialParams?.item,
                            t: partialParams?.item?.t ?? TEST_NOTIFICATIONS_TEMPLATE_TYPE
                          },
                          ownershipKey: p.documentKey,
                          ...partialParams
                        };

                        const createdNotificationDocumentRef = await f.demoFirestoreCollections.firestoreContext.runTransaction(async (transaction) => {
                          const result = await createNotificationInTransaction(createParams, transaction);
                          return result.documentRef;
                        });

                        notificationDocument = f.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocument(createdNotificationDocumentRef);
                      });
                    }

                    describe('unknown notification type', () => {
                      describe('sendType=INIT_BOX_AND_SEND', () => {
                        initNotification(NotificationSendType.INIT_BOX_AND_SEND, () => ({ item: { t: 'unknown_type' } }));
                        demoNotificationContext({ f, nb, doc: () => notificationDocument }, (nbn) => {
                          describe('via sendQueuedNotifications()', () => {
                            it('should have tried but not sent the queued notification.', async () => {
                              const result = await nbn.sendAllQueuedNotifications();
                              expect(result.notificationsVisited).toBe(1);
                              expect(result.notificationsFailed).toBe(1);
                              expect(result.notificationsDeleted).toBe(0);
                            });
                          });

                          describe('via sendNotification()', () => {
                            it('should not have created a NotificationBox and increased the try send count by one', async () => {
                              let notificationBoxExists = await nb.document.exists();
                              expect(notificationBoxExists).toBe(false);

                              const result = await nbn.sendNotification();

                              expect(result.tryRun).toBe(false);
                              expect(result.success).toBe(false);
                              expect(result.deletedNotification).toBe(false);

                              // check still does not exist
                              notificationBoxExists = await nb.document.exists();
                              expect(notificationBoxExists).toBe(false);

                              // check notification changes
                              const notification = await assertSnapshotData(nbn.document);

                              expect(notification.a).toBe(1); // send count increases by one
                              expect(isFuture(notification.sat)).toBe(true);
                            });

                            describe('send count is at maximum tries', () => {
                              beforeEach(async () => {
                                await nbn.document.update({ a: UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS });
                              });

                              it('should have tried but and deleted the queued notification.', async () => {
                                const result = await nbn.sendAllQueuedNotifications();
                                expect(result.notificationsVisited).toBe(1);
                                expect(result.notificationsFailed).toBe(1);
                                expect(result.notificationsDeleted).toBe(1);
                              });

                              it('should not have created a NotificationBox and deleted the notification', async () => {
                                let notificationBoxExists = await nb.document.exists();
                                expect(notificationBoxExists).toBe(false);

                                const result = await nbn.sendNotification();

                                expect(result.tryRun).toBe(false);
                                expect(result.success).toBe(false);
                                expect(result.deletedNotification).toBe(true);

                                // check still does not exist
                                notificationBoxExists = await nb.document.exists();
                                expect(notificationBoxExists).toBe(false);

                                // check notification changes
                                const notificationExists = await nbn.document.exists();
                                expect(notificationExists).toBe(false); // send count increases by one
                              });
                            });
                          });
                        });
                      });
                    });

                    describe('sendType', () => {
                      describe('SEND_IF_BOX_EXISTS', () => {
                        initNotification(NotificationSendType.SEND_IF_BOX_EXISTS);
                        demoNotificationContext({ f, nb, doc: () => notificationDocument }, (nbn) => {
                          describe('send', () => {
                            it('should not have sent and should have deleted the notification', async () => {
                              let notificationBoxExists = await nb.document.exists();
                              expect(notificationBoxExists).toBe(false);

                              const result = await nbn.sendNotification();

                              expect(result.tryRun).toBe(false);
                              expect(result.success).toBe(true);
                              expect(result.deletedNotification).toBe(true);

                              // check still does not exist
                              notificationBoxExists = await nb.document.exists();
                              expect(notificationBoxExists).toBe(false);
                            });
                          });
                        });
                      });

                      describe('INIT_BOX_AND_SEND', () => {
                        initNotification(NotificationSendType.INIT_BOX_AND_SEND);

                        demoNotificationContext({ f, nb, doc: () => notificationDocument }, (nbn) => {
                          describe('send', () => {
                            describe('notification box does not exist', () => {
                              it('should have created the NotificationBox', async () => {
                                let notificationBoxExists = await nb.document.exists();
                                expect(notificationBoxExists).toBe(false);

                                const result = await nbn.sendNotification();

                                expect(result.tryRun).toBe(false);
                                expect(result.success).toBe(false);
                                expect(result.deletedNotification).toBe(false);
                                expect(result.createdBox).toBe(true);

                                // check exists
                                notificationBoxExists = await nb.document.exists();
                                expect(notificationBoxExists).toBe(true);

                                const notificationBox = await assertSnapshotData(nb.document);
                                expect(notificationBox.s).toBe(true); // needs to be sync'd
                              });

                              it('should not have sent the notification since the box is not initialized', async () => {
                                const result = await nbn.sendNotification();

                                expect(result.tryRun).toBe(false);
                                expect(result.success).toBe(false);
                                expect(result.deletedNotification).toBe(false);
                                expect(result.emailsSent).toBeUndefined();

                                // check update
                                const notification = await assertSnapshotData(nbn.document);
                                expect(notification.d).toBe(false);
                              });
                            });

                            describe('notification box exists', () => {
                              describe('NotificationBox is flagged initialized', () => {
                                demoNotificationBoxContext({ f, for: p, initIfNeeded: true }, () => {
                                  it('should have sent the notification', async () => {
                                    const notificationBox = await assertSnapshotData(nb.document);
                                    expect(notificationBox.s).toBeUndefined(); // initialized

                                    const result = await nbn.sendNotification();

                                    expect(result.tryRun).toBe(true);
                                    expect(result.success).toBe(true);
                                    expect(result.deletedNotification).toBe(false);
                                    expect(result.emailsSent).toBe(0); // no recipients for the notification

                                    // check update
                                    const notification = await assertSnapshotData(nbn.document);
                                    expect(notification.d).toBe(true);
                                  });
                                });
                              });

                              describe('NotificationBox is not flagged as initialized', () => {
                                demoNotificationBoxContext({ f, for: p, createIfNeeded: true }, () => {
                                  it('should not have sent the notification since the box is not initialized', async () => {
                                    let notificationBox = await assertSnapshotData(nb.document);
                                    expect(notificationBox.s).toBe(true); // needs to be sync'd

                                    const result = await nbn.sendNotification();

                                    expect(result.tryRun).toBe(false);
                                    expect(result.success).toBe(false);
                                    expect(result.deletedNotification).toBe(false);
                                    expect(result.emailsSent).toBeUndefined();

                                    // check not sent
                                    const notification = await assertSnapshotData(nbn.document);
                                    expect(notification.d).toBe(false);

                                    notificationBox = await assertSnapshotData(nb.document);
                                    expect(notificationBox.s).toBe(true); // still needs to be sync'd
                                  });
                                });
                              });
                            });
                          });
                        });
                      });

                      describe('SEND_WITHOUT_CREATING_BOX', () => {
                        initNotification(NotificationSendType.SEND_WITHOUT_CREATING_BOX);

                        demoNotificationContext({ f, nb, doc: () => notificationDocument }, (nbn) => {
                          describe('send', () => {
                            it('should have sent without creating the NotificationBox', async () => {
                              let notificationBoxExists = await nb.document.exists();
                              expect(notificationBoxExists).toBe(false);

                              const result = await nbn.sendNotification();

                              expect(result.tryRun).toBe(true);
                              expect(result.success).toBe(true);
                              expect(result.deletedNotification).toBe(false);

                              // check still does not exist
                              notificationBoxExists = await nb.document.exists();
                              expect(notificationBoxExists).toBe(false);
                            });
                          });
                        });
                      });
                    });

                    describe('multiple notifications', () => {
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND);
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND);
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND);

                      demoNotificationBoxContext({ f, for: p, initIfNeeded: true }, () => {
                        it('should queue up multiple notifications', async () => {
                          const result = await nb.loadAllNotificationsForNotificationBox();
                          expect(result.length).toBe(3);
                        });
                      });
                    });

                    describe('Notifications partially sent (email success)', () => {
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND);
                      demoNotificationContext({ f, nb, doc: () => notificationDocument }, (nbn) => {
                        demoNotificationBoxContext({ f, for: p, initIfNeeded: true }, () => {
                          beforeEach(async () => {
                            await nbn.sendNotification();
                          });

                          describe('attempting to send too early', () => {
                            beforeEach(async () => {
                              // mark as not done and queued
                              await nbn.document.update({
                                d: false,
                                ts: NotificationSendState.QUEUED,
                                sat: addMinutes(new Date(), 1) // cannot send for another minute
                              });
                            });

                            it('should not attempt to be sent via send all', async () => {
                              const result = await nbn.sendAllQueuedNotifications();
                              expect(result.notificationsVisited).toBe(0);
                            });

                            it('should not attempt to send again (send throttling)', async () => {
                              const result = await nbn.sendNotification();

                              expect(result.emailsSent).toBeUndefined(); // not attempted
                              expect(result.tryRun).toBe(false);
                              expect(result.success).toBe(false);
                            });
                          });

                          describe('texts not sent', () => {
                            beforeEach(async () => {
                              // mark as not done and queued
                              await nbn.document.update({ sat: new Date(), d: false, ts: NotificationSendState.QUEUED });
                            });

                            it('should attempt to send the text notifications again', async () => {
                              const result = await nbn.sendNotification();

                              expect(result.emailsSent).toBeUndefined(); // not attempted
                              expect(result.tryRun).toBe(true);
                              expect(result.success).toBe(true);
                            });
                          });
                        });
                      });
                    });

                    describe('Notification Sent', () => {
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND);
                      demoNotificationContext({ f, nb, doc: () => notificationDocument }, (nbn) => {
                        demoNotificationBoxContext({ f, for: p, initIfNeeded: true }, () => {
                          describe('cleanupSentNotificationsFactory()', () => {
                            it('should not clean up the unsent notification', async () => {
                              let allExistingNotifications = await nb.loadAllNotificationsForNotificationBox();
                              expect(allExistingNotifications.length).toBe(1);

                              await nbn.cleanupAllSentNotifications();

                              allExistingNotifications = await nb.loadAllNotificationsForNotificationBox();
                              expect(allExistingNotifications.length).toBe(1);
                            });

                            describe('notification sent/done', () => {
                              beforeEach(async () => {
                                // mark as sent/done
                                await nbn.document.update({ d: true });
                              });

                              it('should clean up the sent notification', async () => {
                                let allExistingNotifications = await nb.loadAllNotificationsForNotificationBox();
                                expect(allExistingNotifications.length).toBe(1);

                                let allExistingNotificationWeeks = await nb.loadAllNotificationWeeksForNotificationBox();
                                expect(allExistingNotificationWeeks.length).toBe(0);

                                const result = await nbn.cleanupAllSentNotifications();
                                expect(result.notificationBoxesUpdatesCount).toBe(1);
                                expect(result.notificationsDeleted).toBe(1);
                                expect(result.notificationWeeksCreated).toBe(1);
                                expect(result.notificationWeeksUpdated).toBe(0);

                                allExistingNotifications = await nb.loadAllNotificationsForNotificationBox();
                                expect(allExistingNotifications.length).toBe(0);

                                allExistingNotificationWeeks = await nb.loadAllNotificationWeeksForNotificationBox();
                                expect(allExistingNotificationWeeks.length).toBe(1);
                              });
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

  // TODO: Test that notifications going to global recipients or explicit recipients is not saved to the NotificationWeek.
});
