import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { APP_CODE_PREFIX_CAMELApiFunctionContextFactory, APP_CODE_PREFIX_CAMELAuthorizedUserContext, APP_CODE_PREFIX_CAMELNotificationBoxContext, APP_CODE_PREFIX_CAMELProfileContext } from '../../../test/fixture';
import { APP_CODE_PREFIX_CAMELCallModel } from '../model/crud.functions';

APP_CODE_PREFIX_CAMELApiFunctionContextFactory((f) => {
  describeCallableRequestTest('storagefile.scenario', { f, fns: { APP_CODE_PREFIX_CAMELCallModel } }, ({ APP_CODE_PREFIX_CAMELCallModelWrappedFn }) => {
    APP_CODE_PREFIX_CAMELAuthorizedUserContext({ f }, (u) => {

      it('todo', () => {

        // TODO: Test your storage file uploads here
        
      });

    });
  });
});
