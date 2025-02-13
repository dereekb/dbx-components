import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext, demoNotificationBoxContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { Notification, DocumentDataWithIdAndKey } from '@dereekb/firebase';
import { GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE } from '@dereekb/demo-firebase';

demoApiFunctionContextFactory((f) => {
  describeCloudFunctionTest('notification.scenario', { f, fns: { demoCallModel } }, ({ demoCallModelCloudFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      describe('profile', () => {
        demoProfileContext({ f, u }, (p) => {
          demoNotificationBoxContext({ f, for: p, createIfNeeded: true }, (profileNb) => {
            it('should initialize the notification box for the profile.', async () => {
              await profileNb.initializeNotificationBox();

              const notificationBox = await assertSnapshotData(profileNb.document);
              expect(notificationBox.s).toBeUndefined(); // is now synced/initialized

              const recipients = notificationBox.r;
              const recipient = recipients[0];

              expect(recipients.length).toBe(1);
              expect(recipient.uid).toBe(u.uid); // added user as recipient automatically
            });
          });
        });
      });

      describe('guestbook', () => {
        demoGuestbookContext({ f, published: true }, (g) => {
          demoNotificationBoxContext({ f, for: g, createIfNeeded: true }, (guestbookNb) => {
            it('should initialized the notification box for the guestbook', async () => {
              await guestbookNb.initializeNotificationBox();

              const notificationBox = await assertSnapshotData(guestbookNb.document);
              expect(notificationBox.s).toBeUndefined(); // is now synced/initialized

              const recipients = notificationBox.r;
              expect(recipients.length).toBe(0);
            });

            describe('guestbook entry created', () => {
              demoGuestbookEntryContext({ f, u, g, init: false }, (ge) => {
                it('should create a new notification when an entry is created', async () => {
                  expect(await ge.document.exists()).toBe(false);

                  let notifications = await guestbookNb.loadAllNotificationsForNotificationBox();
                  expect(notifications.length).toBe(0);

                  await ge.init();

                  notifications = await guestbookNb.loadAllNotificationsForNotificationBox();
                  expect(notifications.length).toBe(1);

                  const notification = notifications[0].data as DocumentDataWithIdAndKey<Notification>;
                  expect(notification.n.t).toBe(GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE);
                });
              });
            });
          });
        });
      });

      describe('guestbook entry', () => {
        demoGuestbookContext({ f, published: true }, (g) => {
          demoGuestbookEntryContext({ f, u, g }, (ge) => {
            demoNotificationBoxContext({ f, for: ge, createIfNeeded: true }, (guestbookEntryNb) => {
              it('should flag the NotificationBox as invalid when initialized', async () => {
                await guestbookEntryNb.initializeNotificationBox();

                const notificationBox = await assertSnapshotData(guestbookEntryNb.document);

                expect(notificationBox.fi).toBe(true);
                expect(notificationBox.s).toBe(false);
              });
            });
          });
        });
      });
    });
  });
});
