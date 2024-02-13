import { ExampleReadParams, ExampleReadResponse } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext } from '../../../test/fixture';
import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { onCallReadModelParams, systemStateIdentity } from '@dereekb/firebase';
import { demoCallModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCloudFunctionTest('systemStateExampleRead', { f, fns: { demoCallModel } }, ({ demoCallModelCloudFn }) => {
    demoAuthorizedUserAdminContext({ f }, (u) => {
      it('should return the message', async () => {
        const message = 'test message';

        const params: ExampleReadParams = {
          message
        };

        const result: ExampleReadResponse = await u.callCloudFunction(demoCallModelCloudFn, onCallReadModelParams(systemStateIdentity, params, 'exampleread'));

        expect(result).toBeDefined();
        expect(result.message).toBe(message);
      });
    });
  });
});
