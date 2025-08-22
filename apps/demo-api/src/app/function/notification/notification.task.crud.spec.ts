import { demoCallModel } from '../model/crud.functions';
import { addMinutes, addMonths, isFuture } from 'date-fns';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoNotificationBoxContext, demoNotificationContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { NotificationDocument, NotificationSendState, NotificationSendType, createNotificationDocument, CreateNotificationTemplate, delayCompletion } from '@dereekb/firebase';
import { EXAMPLE_NOTIFICATION_TASK_PART_B_COMPLETE_VALUE, exampleNotificationTaskTemplate, exampleNotificationTaskWithNoModelTemplate, exampleUniqueNotificationTaskTemplate } from 'demo-firebase';
import { NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS, UNKNOWN_NOTIFICATION_TASK_TYPE_DELETE_AFTER_RETRY_ATTEMPTS } from '@dereekb/firebase-server/model';
import { expectFail, itShouldFail } from '@dereekb/util/test';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notification.task.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('model', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        // use profile as the primary notification model target
        demoProfileContext({ f, u }, (p) => {
          demoNotificationBoxContext({ f, for: p, initIfNeeded: false }, (nb) => {
            describe('Notification', () => {
              describe('notification created', () => {
                let notificationDocument: NotificationDocument;

                function initNotificationTask(loadParams?: () => Partial<CreateNotificationTemplate>) {
                  beforeEach(async () => {
                    const partialParams = await loadParams?.();

                    const baseTemplate = exampleNotificationTaskTemplate({
                      profileDocument: p.document
                    });

                    const template: CreateNotificationTemplate = {
                      ...baseTemplate,
                      ...partialParams,
                      st: NotificationSendType.TASK_NOTIFICATION
                    };

                    const result = await createNotificationDocument({
                      context: f.demoFirestoreCollections,
                      template
                    });

                    notificationDocument = result.notificationDocument;
                  });
                }

                describe('unknown notification task type', () => {
                  initNotificationTask(() => {
                    const template = exampleNotificationTaskTemplate({
                      profileDocument: p.document
                    });

                    template.n.t = 'UNKNOWN_TASK_TYPE';

                    return template;
                  });

                  demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
                    describe('via sendQueuedNotifications()', () => {
                      it('should have failed to handle the notification.', async () => {
                        const result = await nbn.sendAllQueuedNotifications();
                        expect(result.notificationTasksVisited).toBe(1);
                        expect(result.notificationsVisited).toBe(1);
                        expect(result.notificationsFailed).toBe(1);
                        expect(result.notificationsDeleted).toBe(0);
                      });
                    });

                    describe('via sendNotification()', () => {
                      it('should not have created a NotificationBox and increased the attempt count by one', async () => {
                        const result = await nbn.sendNotification();

                        expect(result.tryRun).toBe(false);
                        expect(result.success).toBe(false);
                        expect(result.deletedNotification).toBe(false);

                        // check notification changes
                        const notification = await assertSnapshotData(nbn.document);

                        expect(notification.a).toBe(1); // send attempt count increases by one
                        expect(isFuture(notification.sat)).toBe(true);
                      });

                      describe('attempt count is at maximum tries', () => {
                        beforeEach(async () => {
                          await nbn.document.update({ a: UNKNOWN_NOTIFICATION_TASK_TYPE_DELETE_AFTER_RETRY_ATTEMPTS });
                        });

                        it('should have tried and deleted the queued notification task', async () => {
                          const result = await nbn.sendAllQueuedNotifications();
                          expect(result.notificationTasksVisited).toBe(1);
                          expect(result.notificationsVisited).toBe(1);
                          expect(result.notificationsFailed).toBe(1);
                          expect(result.notificationsDeleted).toBe(1);
                          expect(result.notificationTaskCompletionType).toBeUndefined();
                        });

                        it('should not have created a NotificationBox and deleted the notification', async () => {
                          const result = await nbn.sendNotification();

                          expect(result.tryRun).toBe(false);
                          expect(result.success).toBe(false);
                          expect(result.deletedNotification).toBe(true);
                          expect(result.notificationTaskCompletionType).toBeUndefined();

                          // check notification box does not exists
                          const notificationBoxExists = await nb.document.exists();
                          expect(notificationBoxExists).toBe(false);

                          // check notification changes
                          const notificationExists = await nbn.document.exists();
                          expect(notificationExists).toBe(false);
                        });
                      });
                    });
                  });
                });

                describe('known notification type', () => {
                  function describeTestsWithLoadParams(description: string, loadParams?: () => Partial<CreateNotificationTemplate>) {
                    describe(description, () => {
                      initNotificationTask(loadParams);

                      demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
                        describe('handle task', () => {
                          it('should have handled the notification task', async () => {
                            let notification = await assertSnapshotData(nbn.document);
                            expect((notification.n.d as any)?.value).not.toBe(EXAMPLE_NOTIFICATION_TASK_PART_B_COMPLETE_VALUE);

                            const result = await nbn.sendNotification();

                            expect(result.tryRun).toBe(true);
                            expect(result.success).toBe(true);
                            expect(result.isNotificationTask).toBe(true);
                            expect(result.boxExists).toBe(false);
                            expect(result.deletedNotification).toBe(false);
                            expect(result.notificationTaskCompletionType).toBe('part_b'); // part_b should be completed now

                            notification = await assertSnapshotData(nbn.document);
                            expect((notification.n.d as any)?.value).toBe(EXAMPLE_NOTIFICATION_TASK_PART_B_COMPLETE_VALUE);
                          });

                          describe('task fails', () => {
                            const failureDelayUntil = addMonths(new Date(), 1);

                            beforeEach(async () => {
                              const notification = await assertSnapshotData(nbn.document);

                              await nbn.document.update({
                                n: {
                                  ...notification.n,
                                  d: {
                                    result: {
                                      completion: false,
                                      delayUntil: failureDelayUntil.toISOString() // define a next time to delay until
                                    }
                                  }
                                }
                              });
                            });

                            it('should have failed to handle the notification task', async () => {
                              const result = await nbn.sendNotification();

                              expect(result.tryRun).toBe(true);
                              expect(result.success).toBe(false);
                              expect(result.deletedNotification).toBe(false);
                              expect(result.notificationTaskCompletionType).toBe(false);

                              const notification = await assertSnapshotData(nbn.document);
                              expect(notification.sat).toBeSameSecondAs(failureDelayUntil);
                              expect(notification.a).toBe(1); // send attempt count increases by one
                            });

                            describe('attempt count is at maximum tries', () => {
                              beforeEach(async () => {
                                await nbn.document.update({ a: NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS });
                              });

                              it('should have deleted the queued notification task', async () => {
                                const result = await nbn.sendNotification();

                                expect(result.tryRun).toBe(false);
                                expect(result.success).toBe(false);
                                expect(result.deletedNotification).toBe(true);
                                expect(result.notificationTaskCompletionType).toBeUndefined();

                                const notificationExists = await nbn.document.exists();
                                expect(notificationExists).toBe(false);
                              });
                            });
                          });

                          describe('task delay result during run', () => {
                            const delayUntil = addMonths(new Date(), 1);

                            beforeEach(async () => {
                              const notification = await assertSnapshotData(nbn.document);

                              await nbn.document.update({
                                n: {
                                  ...notification.n,
                                  d: {
                                    result: {
                                      completion: delayCompletion(), // no
                                      delayUntil: delayUntil.toISOString()
                                    }
                                  }
                                }
                              });
                            });

                            it('should delay the next notification run', async () => {
                              const result = await nbn.sendNotification();

                              expect(result.tryRun).toBe(true);
                              expect(result.success).toBe(true); // was successful
                              expect(result.deletedNotification).toBe(false);
                              expect(result.notificationTaskCompletionType).toBeDefined(); // empty array

                              // check notification changes
                              const notification = await assertSnapshotData(nbn.document);
                              expect(notification.sat).toBeSameSecondAs(delayUntil);
                              expect(notification.a).toBe(1); // send attempt should still be 1
                            });
                          });
                        });
                      });
                    });
                  }

                  describeTestsWithLoadParams('with notification model', () => {
                    return exampleNotificationTaskTemplate({
                      profileDocument: p.document,
                      completedCheckpoints: ['part_a'] // part_a is complete
                    });
                  });

                  describeTestsWithLoadParams('without notification model', () => {
                    return exampleNotificationTaskWithNoModelTemplate({
                      uid: p.document.id,
                      completedCheckpoints: ['part_a'] // part_a is complete
                    });
                  });
                });

                describe('multiple notifications', () => {
                  describe('non-unique notification', () => {
                    initNotificationTask();
                    initNotificationTask();
                    initNotificationTask();

                    it('should return the multiple notifications when querying for notifications', async () => {
                      const result = await nb.loadAllNotificationsForNotificationBox();
                      expect(result.length).toBe(3);
                    });
                  });

                  describe('unique notifications', () => {
                    function initUniqueNotificationTask() {
                      initNotificationTask(() => {
                        return exampleUniqueNotificationTaskTemplate({
                          profileDocument: p.document,
                          overrideExistingTask: true
                        });
                      });
                    }

                    // init 3 of the same unique notification
                    initUniqueNotificationTask();
                    initUniqueNotificationTask();
                    initUniqueNotificationTask();

                    it('should have only created a single notification', async () => {
                      const result = await nb.loadAllNotificationsForNotificationBox();
                      expect(result.length).toBe(1);
                    });

                    it('should override the existing notification if overrideExistingTask is true', async () => {
                      let existingNotifications = await nb.loadAllNotificationsForNotificationBox();
                      expect(existingNotifications.length).toBe(1);

                      // update tpr
                      await existingNotifications[0].document.update({
                        tpr: ['part_a', 'part_b']
                      });

                      // verify update
                      existingNotifications = await nb.loadAllNotificationsForNotificationBox();
                      expect(existingNotifications[0].data?.tpr).toEqual(['part_a', 'part_b']);

                      const template = exampleUniqueNotificationTaskTemplate({
                        profileDocument: p.document,
                        overrideExistingTask: true
                      });

                      await createNotificationDocument({
                        context: f.demoFirestoreCollections,
                        template
                      });

                      existingNotifications = await nb.loadAllNotificationsForNotificationBox();
                      expect(existingNotifications.length).toBe(1);
                      expect(existingNotifications[0].data?.tpr).toHaveLength(0); // show that the notification was overwritten
                    });

                    itShouldFail('to create a unique notification if one already exists and overrideExistingTask is false', async () => {
                      const template = exampleUniqueNotificationTaskTemplate({
                        profileDocument: p.document,
                        overrideExistingTask: false
                      });

                      await expectFail(() =>
                        createNotificationDocument({
                          context: f.demoFirestoreCollections,
                          template
                        })
                      );
                    });
                  });
                });

                describe('Notification checkpoint', () => {
                  initNotificationTask();
                  demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
                    demoNotificationBoxContext({ f, for: p, initIfNeeded: false }, () => {
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

                          expect(result.sendEmailsResult).toBeUndefined(); // not attempted
                          expect(result.tryRun).toBe(false);
                          expect(result.success).toBe(false);
                        });
                      });
                    });
                  });
                });

                describe('Notification Sent', () => {
                  initNotificationTask();
                  demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
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
                          expect(result.notificationWeeksCreated).toBe(0); // notification tasks do not create weeks
                          expect(result.notificationWeeksUpdated).toBe(0);

                          allExistingNotifications = await nb.loadAllNotificationsForNotificationBox();
                          expect(allExistingNotifications.length).toBe(0); // no more notifications

                          allExistingNotificationWeeks = await nb.loadAllNotificationWeeksForNotificationBox();
                          expect(allExistingNotificationWeeks.length).toBe(0); // no weeks created
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
  });
});
