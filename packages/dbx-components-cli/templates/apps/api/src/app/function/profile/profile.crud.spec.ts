import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { APP_CODE_PREFIX_CAMELApiFunctionContextFactory, APP_CODE_PREFIX_CAMELAuthorizedUserAdminContext, APP_CODE_PREFIX_CAMELProfileContext } from '../../../test/fixture';
import { APP_CODE_PREFIX_CAMELCallModel } from '../model/crud.functions';

APP_CODE_PREFIX_CAMELApiFunctionContextFactory((f) => {
  describeCallableRequestTest('profile.crud', { f, fns: { APP_CODE_PREFIX_CAMELCallModel } }, ({ APP_CODE_PREFIX_CAMELCallModelWrappedFn }) => {
    describe('Profile', () => {
      APP_CODE_PREFIX_CAMELAuthorizedUserAdminContext({ f }, (u) => {
        APP_CODE_PREFIX_CAMELProfileContext({ f, u }, (p) => {
          // TODO: Test the profile test notifications
          it('todo', () => {});
        });
      });
    });
  });
});
