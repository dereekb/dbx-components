import { demoDevelopmentFunctionMap } from './../model/development.functions';
import { demoExampleUsageOfSchedule } from '../model/schedule.functions';
import { CreateGuestbookParams, DemoDevelopmentExampleParams, DemoDevelopmentExampleResult, DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER, guestbookIdentity } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { OnCallCreateModelResult, onCallDevelopmentParams, OnCallDevelopmentParams, onCallTypedModelParams } from '@dereekb/firebase';
import { exampleUsageOfSchedule } from './example.schedule';
import { onCallDevelopmentFunction } from '@dereekb/firebase-server';
import { onCallWithDemoNestContext } from '../function';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCloudFunctionTest('exampleUsageOfSchedule', { f, fns: { demoExampleUsageOfSchedule } }, ({ demoExampleUsageOfScheduleCloudFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should execute the scheduled task.', async () => {
        const result = await u.callCloudFunction(demoExampleUsageOfScheduleCloudFn);

        // expect no errors
      });
    });
  });

  describeCloudFunctionTest('exampleDevelopmentFunction', { f, fns: { dev: onCallWithDemoNestContext(onCallDevelopmentFunction(demoDevelopmentFunctionMap)) } }, ({ devCloudFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should execute the development function.', async () => {
        const params: DemoDevelopmentExampleParams = {
          message: 'hello world'
        };

        const result: DemoDevelopmentExampleResult = await u.callCloudFunction(devCloudFn, onCallDevelopmentParams(DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER, params));
        expect(result.message).toBe(params.message);
      });
    });
  });
});
