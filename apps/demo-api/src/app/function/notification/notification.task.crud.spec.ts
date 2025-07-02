import { demoCallModel } from '../model/crud.functions';
import { addMinutes, isFuture } from 'date-fns';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoNotificationBoxContext, demoNotificationContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { NotificationDocument, NotificationSendState, NotificationSendType, createNotificationDocument, CreateNotificationTemplate } from '@dereekb/firebase';
import { exampleNotificationTaskTemplate } from 'demo-firebase';
import { UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS } from '@dereekb/firebase-server/model';

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
                      it('should have tried but not sent the queued notification.', async () => {
                        const result = await nbn.sendAllQueuedNotifications();
                        expect(result.notificationTasksVisited).toBe(1);
                        expect(result.notificationsVisited).toBe(1);
                        expect(result.notificationsFailed).toBe(1);
                        expect(result.notificationsDeleted).toBe(0);
                      });
                    });

                    describe('via sendNotification()', () => {
                      it('should not have created a NotificationBox and increased the try send count by one', async () => {
                        const result = await nbn.sendNotification();

                        expect(result.tryRun).toBe(false);
                        expect(result.success).toBe(false);
                        expect(result.deletedNotification).toBe(false);

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
                          const result = await nbn.sendNotification();

                          expect(result.tryRun).toBe(false);
                          expect(result.success).toBe(false);
                          expect(result.deletedNotification).toBe(true);

                          // check notification changes
                          const notificationExists = await nbn.document.exists();
                          expect(notificationExists).toBe(false); // send count increases by one
                        });
                      });
                    });
                  });
                });

                describe('known notification type', () => {
                  initNotificationTask();
                  demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
                    describe('handle task', () => {
                      it('should have sent the notification', async () => {
                        const result = await nbn.sendNotification();

                        expect(result.tryRun).toBe(true);
                        expect(result.success).toBe(true);
                        expect(result.isNotificationTask).toBe(true);
                        expect(result).toBe(true);
                        expect(result.deletedNotification).toBe(false);
                      });
                    });
                  });
                });

                describe('multiple notifications', () => {
                  initNotificationTask();
                  initNotificationTask();
                  initNotificationTask();

                  demoNotificationBoxContext({ f, for: p, initIfNeeded: true }, () => {
                    it('should queue up multiple notifications', async () => {
                      const result = await nb.loadAllNotificationsForNotificationBox();
                      expect(result.length).toBe(3);
                    });
                  });
                });

                describe('Notifications partially sent (email success)', () => {
                  initNotificationTask();
                  demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
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

                          expect(result.sendEmailsResult).toBeUndefined(); // not attempted
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

                          expect(result.sendEmailsResult).toBeUndefined(); // not attempted
                          expect(result.tryRun).toBe(true);
                          expect(result.success).toBe(true);
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
          });
        });
      });
    });
  });
});
