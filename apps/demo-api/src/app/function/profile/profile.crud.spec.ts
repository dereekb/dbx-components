import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoProfileContext } from 'apps/demo-api/src/test/fixture';
import { demoCallModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f) => {
  describeCloudFunctionTest('profile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelCloudFn }) => {
    describe('Profile', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        demoProfileContext({ f, u }, (p) => {
          // TODO: Test that when a test notification is created the Notification Summary for that profile is also created if it does not exist
          it('todo', () => {});
        });
      });
    });
  });
});
