import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { APP_CODE_PREFIX_CAMELApiFunctionContextFactory, APP_CODE_PREFIX_CAMELAuthorizedUserContext, APP_CODE_PREFIX_CAMELNotificationBoxContext, APP_CODE_PREFIXProfileContext } from '../../../test/fixture';
import { APP_CODE_PREFIX_CAMELCallModel } from '../model/crud.functions';
import { assertSnapshotData } from '@dereekb/firebase-server';

APP_CODE_PREFIX_CAMELApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notification.scenario', { f, fns: { APP_CODE_PREFIX_CAMELCallModel } }, ({ APP_CODE_PREFIX_CAMELCallModelWrappedFn }) => {
    APP_CODE_PREFIX_CAMELAuthorizedUserContext({ f }, (u) => {

      describe('profile', () => {
        APP_CODE_PREFIXProfileContext({ f, u }, (p) => {
          APP_CODE_PREFIX_CAMELNotificationBoxContext({ f, for: p, createIfNeeded: true }, (profileNb) => {
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

    });
  });
});
