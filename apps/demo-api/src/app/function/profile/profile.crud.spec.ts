import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f) => {
  describeCloudFunctionTest('profile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelCloudFn }) => {
    describe('Profile', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        demoProfileContext({ f, u }, (p) => {
          // TODO: Test the profile test notifications
          it('todo', () => {});
        });
      });
    });
  });
});
