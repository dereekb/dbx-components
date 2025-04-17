import { ExampleReadParams, ExampleReadResponse } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { onCallReadModelParams, systemStateIdentity } from '@dereekb/firebase';
import { demoCallModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('systemStateExampleRead', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserAdminContext({ f }, (u) => {
      it('should return the message', async () => {
        const message = 'test message';

        const params: ExampleReadParams = {
          message
        };

        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(systemStateIdentity, params, 'exampleread'))) as ExampleReadResponse;

        expect(result).toBeDefined();
        expect(result.message).toBe(message);
      });
    });
  });
});
