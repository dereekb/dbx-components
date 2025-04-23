import { APP_CODE_PREFIXCallModel } from './../model/crud.functions';
import { APP_CODE_PREFIXCallModelApiFunctionContextFactory } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';

APP_CODE_PREFIXCallModelApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notification.crud', { f, fns: { APP_CODE_PREFIXCallModel } }, ({ APP_CODE_PREFIXCallModelWrappedFn }) => {
    // TODO: Before each, replace the notification sender config, or reference a specific test type that can "test send" things.

    afterEach(() => {
      // f.mailgunService.mailgunApi.config.messages.sendTestEmails = false; // reset to prevent sending test emails by accident
    });

    it('should test', () => {
      // PLACEHOLDER
      expect(true).toBe(true);
    });

  });
});
