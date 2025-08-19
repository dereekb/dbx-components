import { demoCallModel } from './../model/crud.functions';
import { demoApiFunctionContextFactory } from '../../../test/fixture';
import { describeCallableRequestTest, jestExpectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { onCallCreateModelParams, notificationIdentity, OnCallCreateModelResult, DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE } from '@dereekb/firebase';
import { guestbookIdentity, profileIdentity } from 'demo-firebase';
import { expectFail, itShouldFail } from '@dereekb/util/test';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('crud.functions', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('onCall auth tests', () => {
      itShouldFail('to call createGuestbook without auth', async () => {
        const params = {};

        await expectFail(() => demoCallModelWrappedFn(onCallCreateModelParams(guestbookIdentity, params), {}), jestExpectFailAssertHttpErrorServerErrorCode(DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE));
      });

      it('should allow calling createProfilewithout auth', async () => {
        const params = {};

        const result = (await demoCallModelWrappedFn(onCallCreateModelParams(profileIdentity, params), {})) as OnCallCreateModelResult;

        expect(result).toBeDefined();
        expect(result.modelKeys).toBeDefined();
      });

      it('should allow calling createNotification without auth', async () => {
        const params = {};

        const result = (await demoCallModelWrappedFn(onCallCreateModelParams(notificationIdentity, params), {})) as OnCallCreateModelResult;

        expect(result).toBeDefined();
        expect(result.modelKeys).toBeDefined();
      });
    });
  });
});
