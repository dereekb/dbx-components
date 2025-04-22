import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('profile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
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
