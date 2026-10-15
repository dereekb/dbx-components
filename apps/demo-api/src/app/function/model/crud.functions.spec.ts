import { demoCallModel } from './../model/crud.functions';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { onCallCreateModelParams, onCallUpdateModelParams, notificationIdentity, type OnCallCreateModelResult, DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE } from '@dereekb/firebase';
import { FIREBASE_SERVER_VALIDATION_ERROR_CODE } from '@dereekb/firebase-server';
import { guestbookIdentity, profileIdentity } from 'demo-firebase';
import { expectFail, itShouldFail } from '@dereekb/util/test';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('crud.functions', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('onCall auth tests', () => {
      itShouldFail('to call guestbookCreate without auth', async () => {
        const params = {};

        await expectFail(() => demoCallModelWrappedFn(onCallCreateModelParams(guestbookIdentity, params), {}), expectFailAssertHttpErrorServerErrorCode(DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE));
      });

      it('should allow calling createProfilewithout auth', async () => {
        const params = {};

        const result = (await demoCallModelWrappedFn(onCallCreateModelParams(profileIdentity, params), {})) as OnCallCreateModelResult;

        expect(result).toBeDefined();
        expect(result.modelKeys).toBeDefined();
      });

      it('should allow calling notificationCreate without auth', async () => {
        const params = {};

        const result = (await demoCallModelWrappedFn(onCallCreateModelParams(notificationIdentity, params), {})) as OnCallCreateModelResult;

        expect(result).toBeDefined();
        expect(result.modelKeys).toBeDefined();
      });
    });

    describe('input validation', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        itShouldFail('to call profile onboard with params that do not match its inputType', async () => {
          // the onboard handler calls no validating action, so this proves the dispatch checks the declared inputType
          const params = onCallUpdateModelParams(profileIdentity, { key: 5 } as any, 'onboard');
          await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, params), expectFailAssertHttpErrorServerErrorCode(FIREBASE_SERVER_VALIDATION_ERROR_CODE));
        });
      });
    });
  });
});
