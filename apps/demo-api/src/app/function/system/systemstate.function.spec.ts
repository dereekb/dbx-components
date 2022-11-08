import { ExampleReadParams, ExampleReadResponse } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoAuthorizedUserAdminContext } from '../../../test/fixture';
import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { onCallTypedModelParams, systemStateIdentity } from '@dereekb/firebase';
import { demoReadModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCloudFunctionTest('systemStateExampleRead', { f, fns: { demoReadModel } }, ({ demoReadModelCloudFn }) => {
    demoAuthorizedUserAdminContext({ f }, (u) => {
      it('should return the message', async () => {
        const message = 'test message';

        const params: ExampleReadParams = {
          message
        };

        const result: ExampleReadResponse = await u.callCloudFunction(demoReadModelCloudFn, onCallTypedModelParams(systemStateIdentity, params, 'exampleread'));

        expect(result).toBeDefined();
        expect(result.message).toBe(message);
      });
    });
  });
});
