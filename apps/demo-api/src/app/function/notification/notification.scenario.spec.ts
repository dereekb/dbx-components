import { describeCloudFunctionTest, jestExpectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext, demoNotificationBoxContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { Notification, DocumentDataWithIdAndKey, onCallUpdateModelParams, NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE } from '@dereekb/firebase';
import { GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, guestbookIdentity, SubscribeToGuestbookNotificationsParams } from '@dereekb/demo-firebase';
import { expectFail, itShouldFail } from '@dereekb/util/test';

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

            describe('adding notification recipient', () => {
              demoAuthorizedUserAdminContext({ f }, (au) => {
                describe('recipient exists', () => {
                  it('should add the user as a notiication recipient', async () => {
                    const params: SubscribeToGuestbookNotificationsParams = {
                      uid: u.uid,
                      key: g.documentKey
                    };

                    await au.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(guestbookIdentity, params, 'subscribeToNotifications'));

                    const notificationBox = await assertSnapshotData(guestbookNb.document);

                    const recipients = notificationBox.r;
                    expect(recipients.length).toBe(1);
                    expect(recipients[0].uid).toBe(u.uid);
                  });
                });

                describe('recipient does not exist', () => {
                  itShouldFail('to add a user that does not exist as a recipient', async () => {
                    const params: SubscribeToGuestbookNotificationsParams = {
                      uid: 'doesnotexist',
                      key: g.documentKey
                    };

                    await expectFail(
                      () => au.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(guestbookIdentity, params, 'subscribeToNotifications')),
                      // should throw NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE
                      jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE)
                    );
                  });
                });
              });
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

      describe('invalid notification box model types', () => {
        demoGuestbookContext({ f, published: true }, (g) => {
          describe('guestbook entry', () => {
            demoGuestbookEntryContext({ f, u, g }, (ge) => {
              demoNotificationBoxContext({ f, for: ge, createIfNeeded: true }, (guestbookEntryNb) => {
                // NotificationBoxes that are not for a Guestbook entry or a
                it('should flag the guestbook entry NotificationBox as invalid when initialized', async () => {
                  await guestbookEntryNb.initializeNotificationBox();

                  const notificationBox = await assertSnapshotData(guestbookEntryNb.document);

                  expect(notificationBox.s).toBeFalsy();
                  expect(notificationBox.fi).toBe(true);
                });
              });
            });
          });
        });
      });
    });
  });
});
